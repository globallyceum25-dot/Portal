// Package analytics is the Dashboards & Reporting module (spec §13.6). It rolls
// the portal's transactional data (Job Cards, Tasks, CSAT, Knowledge Center,
// Announcements) up into a Report of aggregate metrics for the dashboard views,
// and layers a Narrator on top for natural-language insight summaries.
//
// The Builder reads through the same store.Store seam as every other module, so
// it works against both the in-memory dev store and Postgres. It is RBAC-scoped
// by the caller: a Group Super Admin passes an empty tenant to see all companies;
// a Company Admin / HOD passes their own tenant. Charts are rendered client-side
// (spec §13.6) — this package emits the numbers, not the pixels.
package analytics

import (
	"context"
	"sort"
	"time"

	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// Count is a labelled tally used across the categorical breakdowns.
type Count struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

// TimePoint is one day on a time series.
type TimePoint struct {
	Date  string `json:"date"` // YYYY-MM-DD
	Value int    `json:"value"`
}

// Report is the full dashboard payload (spec §13.6 suggested views).
type Report struct {
	Scope       string    `json:"scope"` // tenant id, or "group" for all-companies
	GeneratedAt time.Time `json:"generated_at"`

	// Headline KPIs.
	OpenRequests   int     `json:"open_requests"`
	ResolvedTotal  int     `json:"resolved_total"`
	TotalRequests  int     `json:"total_requests"`
	SLACompliance  float64 `json:"sla_compliance"`   // % of resolved-or-active cards within SLA
	SLABreaches    int     `json:"sla_breaches"`
	AvgCSAT        float64 `json:"avg_csat"`         // mean 1..5
	CSATResponses  int     `json:"csat_responses"`
	AvgResolveDays float64 `json:"avg_resolve_days"` // mean completion time in days

	// Breakdowns (spec §13.6).
	RequestsByCategory []Count `json:"requests_by_category"`
	RequestsByStatus   []Count `json:"requests_by_status"`
	CSATByCategory     []Count `json:"csat_by_category"` // value = avg rating * 100 (whole number)

	// Two-tier IT flow (spec §3.3 / §13.6).
	LGHITReviewVolume int     `json:"lgh_it_review_volume"`
	ZTEForwardVolume  int     `json:"zte_forward_volume"`
	AvgReviewHours    float64 `json:"avg_review_hours"` // LGH IT → ZTE turnaround

	// Task pipeline (spec §5 → §13.6).
	TasksByStatus  []Count `json:"tasks_by_status"`
	TaskCompletion float64 `json:"task_completion"` // % done

	// Engagement (spec §13.6).
	TopDocuments     []Count `json:"top_documents"`      // by read-confirmations
	AnnouncementRead []Count `json:"announcement_reach"` // reads per announcement

	// Time series: request volume per day, oldest → newest.
	RequestVolume []TimePoint `json:"request_volume"`
}

// Builder assembles Reports from the store.
type Builder struct{ store store.Store }

func NewBuilder(s store.Store) *Builder { return &Builder{store: s} }

// Build computes the report for a tenant scope. An empty tenantID means the
// group-wide view (all companies), reserved by the caller for Group Super Admin.
func (b *Builder) Build(ctx context.Context, tenantID string) (*Report, error) {
	jobs, err := b.allJobCards(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	tasks, err := b.store.ListTasks(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	docs, err := b.store.ListDocuments(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	anns, err := b.store.ListAnnouncements(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	scope := tenantID
	if scope == "" {
		scope = "group"
	}
	r := &Report{Scope: scope, GeneratedAt: time.Now().UTC()}

	byCategory := map[string]int{}
	byStatus := map[string]int{}
	csatSum := map[string]int{}   // category -> sum of ratings
	csatCount := map[string]int{} // category -> #responses
	volByDay := map[string]int{}

	var resolveDaysSum float64
	var resolveCount int
	var withinSLA, slaConsidered int
	var reviewHoursSum float64
	var reviewCount int

	for i := range jobs {
		j := &jobs[i]
		r.TotalRequests++
		byStatus[string(j.Status)]++
		if j.Category != "" {
			byCategory[j.Category]++
		}
		volByDay[j.CreatedAt.Format("2006-01-02")]++

		resolved := j.Status == models.StatusCompleted
		if resolved {
			r.ResolvedTotal++
		} else if j.Status != models.StatusRejected {
			r.OpenRequests++
		}

		// Two-tier IT flow volumes + review turnaround.
		if routedThrough(j, models.QueueLGHIT) {
			r.LGHITReviewVolume++
		}
		if forwardedAt, ok := statusTime(j, models.StatusForwarded); ok {
			r.ZTEForwardVolume++
			reviewHoursSum += forwardedAt.Sub(j.CreatedAt).Hours()
			reviewCount++
		}

		// SLA: consider resolved cards and any card past its deadline.
		if resolved {
			if completedAt, ok := statusTime(j, models.StatusCompleted); ok {
				resolveDaysSum += completedAt.Sub(j.CreatedAt).Hours() / 24
				resolveCount++
				slaConsidered++
				if !j.SLADeadline.IsZero() && !completedAt.After(j.SLADeadline) {
					withinSLA++
				} else if j.SLADeadline.IsZero() {
					withinSLA++ // no SLA set => not counted as a breach
				}
			}
		} else if j.Status != models.StatusRejected && !j.SLADeadline.IsZero() {
			slaConsidered++
			if time.Now().Before(j.SLADeadline) {
				withinSLA++
			} else {
				r.SLABreaches++
			}
		}

		// CSAT.
		if j.CSAT != nil && j.CSAT.Rating > 0 {
			r.CSATResponses++
			cat := j.Category
			if cat == "" {
				cat = "Other"
			}
			csatSum[cat] += j.CSAT.Rating
			csatCount[cat]++
		}
	}

	if resolveCount > 0 {
		r.AvgResolveDays = round1(resolveDaysSum / float64(resolveCount))
	}
	if reviewCount > 0 {
		r.AvgReviewHours = round1(reviewHoursSum / float64(reviewCount))
	}
	if slaConsidered > 0 {
		r.SLACompliance = round1(float64(withinSLA) / float64(slaConsidered) * 100)
	}

	// CSAT overall + per category.
	var ratingSum, ratingCount int
	for cat, sum := range csatSum {
		n := csatCount[cat]
		ratingSum += sum
		ratingCount += n
		r.CSATByCategory = append(r.CSATByCategory, Count{Label: cat, Value: int(round1(float64(sum) / float64(n) * 100))})
	}
	if ratingCount > 0 {
		r.AvgCSAT = round1(float64(ratingSum) / float64(ratingCount))
	}

	r.RequestsByCategory = topCounts(byCategory, 8)
	r.RequestsByStatus = sortedCounts(byStatus)
	sortCounts(r.CSATByCategory)

	// Tasks.
	taskByStatus := map[string]int{"todo": 0, "in_progress": 0, "done": 0}
	done := 0
	for _, t := range tasks {
		taskByStatus[string(t.Status)]++
		if t.Status == models.TaskDone {
			done++
		}
	}
	r.TasksByStatus = []Count{
		{Label: "To Do", Value: taskByStatus["todo"]},
		{Label: "In Progress", Value: taskByStatus["in_progress"]},
		{Label: "Done", Value: taskByStatus["done"]},
	}
	if len(tasks) > 0 {
		r.TaskCompletion = round1(float64(done) / float64(len(tasks)) * 100)
	}

	// Document engagement + announcement reach.
	docCounts := make([]Count, 0, len(docs))
	for _, d := range docs {
		docCounts = append(docCounts, Count{Label: d.Title, Value: len(d.ReadBy)})
	}
	sortCounts(docCounts)
	r.TopDocuments = capCounts(docCounts, 6)

	annCounts := make([]Count, 0, len(anns))
	for _, a := range anns {
		annCounts = append(annCounts, Count{Label: a.Title, Value: len(a.ReadBy)})
	}
	sortCounts(annCounts)
	r.AnnouncementRead = capCounts(annCounts, 6)

	// Request-volume time series over the trailing 14 days.
	r.RequestVolume = lastNDays(volByDay, 14)
	return r, nil
}

// allJobCards unions the three work queues, which together hold every card
// (each card sits in exactly one queue). Empty tenant => all companies.
func (b *Builder) allJobCards(ctx context.Context, tenantID string) ([]models.JobCard, error) {
	var all []models.JobCard
	seen := map[string]bool{}
	for _, q := range []models.Queue{models.QueueLGHIT, models.QueueZTE, models.QueueDepartment} {
		cards, err := b.store.ListJobCardsByQueue(ctx, tenantID, q)
		if err != nil {
			return nil, err
		}
		for _, c := range cards {
			if !seen[c.Ref] {
				seen[c.Ref] = true
				all = append(all, c)
			}
		}
	}
	return all, nil
}

// --- small aggregation helpers ---

func routedThrough(j *models.JobCard, q models.Queue) bool {
	if j.Queue == q {
		return true
	}
	for _, step := range j.RoutePath {
		if step == q {
			return true
		}
	}
	return false
}

func statusTime(j *models.JobCard, s models.JobStatus) (time.Time, bool) {
	for i := len(j.Timeline) - 1; i >= 0; i-- {
		if j.Timeline[i].Status == s {
			return j.Timeline[i].At, true
		}
	}
	return time.Time{}, false
}

func round1(f float64) float64 { return float64(int(f*10+0.5)) / 10 }

func sortCounts(cs []Count) {
	sort.Slice(cs, func(i, j int) bool {
		if cs[i].Value != cs[j].Value {
			return cs[i].Value > cs[j].Value
		}
		return cs[i].Label < cs[j].Label
	})
}

func sortedCounts(m map[string]int) []Count {
	out := make([]Count, 0, len(m))
	for k, v := range m {
		out = append(out, Count{Label: k, Value: v})
	}
	sortCounts(out)
	return out
}

func topCounts(m map[string]int, n int) []Count { return capCounts(sortedCounts(m), n) }

func capCounts(cs []Count, n int) []Count {
	if len(cs) > n {
		return cs[:n]
	}
	return cs
}

func lastNDays(byDay map[string]int, n int) []TimePoint {
	out := make([]TimePoint, 0, n)
	today := time.Now().UTC()
	for i := n - 1; i >= 0; i-- {
		d := today.AddDate(0, 0, -i).Format("2006-01-02")
		out = append(out, TimePoint{Date: d, Value: byDay[d]})
	}
	return out
}
