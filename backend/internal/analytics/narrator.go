package analytics

import (
	"context"
	"fmt"
	"strings"

	"lyceumconnect/backend/internal/config"
)

// Insight is one natural-language observation about the report, tagged with a
// severity the frontend maps to a colour.
type Insight struct {
	Severity string `json:"severity"` // positive | info | warning | critical
	Title    string `json:"title"`
	Detail   string `json:"detail"`
}

// Narrator turns a structured Report into plain-language insight (spec §13.6:
// "the LLM's job is narrative insight, anomaly flagging, and natural-language
// Q&A over the data, not visual rendering"). It plugs in behind the same
// config-gated seam as the meeting analyzer: the always-available Heuristic
// narrator ships by default; the NIM-backed GLM narrator replaces it when NVIDIA
// NIM is configured. Both are grounded in the Report's numbers — the model is
// never asked to invent figures, only to explain the ones it is given.
type Narrator interface {
	Name() string
	Insights(ctx context.Context, r *Report) ([]Insight, error)
	Answer(ctx context.Context, r *Report, question string) (string, error)
}

// Pick returns the NIM narrator when configured, else the heuristic one.
func Pick(cfg config.Config) Narrator {
	if cfg.NIM.Configured() {
		return NewNIMNarrator(cfg.NIM)
	}
	return Heuristic{}
}

// Heuristic derives insights from threshold rules over the report — no model
// required, so the dashboard's narrative panel is always populated.
type Heuristic struct{}

func (Heuristic) Name() string { return "heuristic" }

func (Heuristic) Insights(_ context.Context, r *Report) ([]Insight, error) {
	var out []Insight

	// SLA compliance.
	switch {
	case r.SLABreaches > 0 && r.SLACompliance < 90:
		out = append(out, Insight{"critical", "SLA compliance is below target",
			fmt.Sprintf("%.1f%% of requests are meeting SLA and %d are currently breached. Prioritise the oldest open cards.", r.SLACompliance, r.SLABreaches)})
	case r.SLACompliance >= 95:
		out = append(out, Insight{"positive", "SLA compliance is healthy",
			fmt.Sprintf("%.1f%% of requests are resolved within SLA — comfortably above the 95%% target.", r.SLACompliance)})
	default:
		out = append(out, Insight{"info", "SLA compliance is on track",
			fmt.Sprintf("%.1f%% within SLA with %d breach(es) to watch.", r.SLACompliance, r.SLABreaches)})
	}

	// CSAT.
	if r.CSATResponses > 0 {
		switch {
		case r.AvgCSAT >= 4.2:
			out = append(out, Insight{"positive", "Satisfaction is strong",
				fmt.Sprintf("Average CSAT is %.1f/5 across %d responses.", r.AvgCSAT, r.CSATResponses)})
		case r.AvgCSAT < 3.5:
			out = append(out, Insight{"warning", "Satisfaction needs attention",
				fmt.Sprintf("Average CSAT has slipped to %.1f/5 across %d responses — review recent completions for recurring complaints.", r.AvgCSAT, r.CSATResponses)})
		default:
			out = append(out, Insight{"info", "Satisfaction is steady",
				fmt.Sprintf("Average CSAT is %.1f/5 across %d responses.", r.AvgCSAT, r.CSATResponses)})
		}
	}

	// Busiest category.
	if len(r.RequestsByCategory) > 0 {
		top := r.RequestsByCategory[0]
		out = append(out, Insight{"info", "Highest-volume service",
			fmt.Sprintf("“%s” is the busiest category with %d request(s) — a candidate for a self-service Knowledge Center article.", top.Label, top.Value)})
	}

	// Two-tier IT flow turnaround.
	if r.ZTEForwardVolume > 0 {
		out = append(out, Insight{"info", "LGH IT → ZTE routing",
			fmt.Sprintf("%d request(s) forwarded to ZTE with an average review turnaround of %.1f hours.", r.ZTEForwardVolume, r.AvgReviewHours)})
	}

	// Task pipeline.
	if total := sumCounts(r.TasksByStatus); total > 0 {
		sev := "info"
		if r.TaskCompletion < 40 {
			sev = "warning"
		}
		out = append(out, Insight{sev, "Meeting-task completion",
			fmt.Sprintf("%.0f%% of the %d task(s) generated from meetings are done.", r.TaskCompletion, total)})
	}

	if len(out) == 0 {
		out = append(out, Insight{"info", "No activity yet",
			"There is not enough data in this scope to surface trends. Submit some requests to populate the dashboard."})
	}
	return out, nil
}

// Answer gives a grounded, templated reply to an ad-hoc question by pointing at
// the report figures most relevant to the question's keywords. It never fabricates
// numbers: everything it states comes straight out of the Report.
func (Heuristic) Answer(_ context.Context, r *Report, question string) (string, error) {
	q := strings.ToLower(question)
	switch {
	case containsAny(q, "csat", "satisfaction", "happy", "rating"):
		if r.CSATResponses == 0 {
			return "No CSAT responses have been recorded in this scope yet.", nil
		}
		b := &strings.Builder{}
		fmt.Fprintf(b, "Average CSAT is %.1f/5 across %d responses.", r.AvgCSAT, r.CSATResponses)
		if len(r.CSATByCategory) > 0 {
			low := r.CSATByCategory[len(r.CSATByCategory)-1]
			fmt.Fprintf(b, " The lowest-rated category is “%s” at %.1f/5.", low.Label, float64(low.Value)/100)
		}
		return b.String(), nil
	case containsAny(q, "sla", "breach", "overdue", "late", "deadline"):
		return fmt.Sprintf("SLA compliance is %.1f%% with %d breach(es) currently open.", r.SLACompliance, r.SLABreaches), nil
	case containsAny(q, "zte", "routing", "forward", "review", "turnaround"):
		return fmt.Sprintf("%d request(s) went through LGH IT review and %d were forwarded to ZTE, averaging %.1f hours of review time.",
			r.LGHITReviewVolume, r.ZTEForwardVolume, r.AvgReviewHours), nil
	case containsAny(q, "task", "meeting", "action item"):
		return fmt.Sprintf("%.0f%% of meeting-generated tasks are complete (%d total).", r.TaskCompletion, sumCounts(r.TasksByStatus)), nil
	case containsAny(q, "busy", "volume", "most", "category", "popular"):
		if len(r.RequestsByCategory) == 0 {
			return "No requests have been logged in this scope yet.", nil
		}
		top := r.RequestsByCategory[0]
		return fmt.Sprintf("The highest-volume category is “%s” with %d request(s), out of %d total.", top.Label, top.Value, r.TotalRequests), nil
	default:
		return fmt.Sprintf("In this scope: %d total requests (%d open, %d resolved), %.1f%% SLA compliance, and an average CSAT of %.1f/5. Ask about SLA, CSAT, ZTE routing, tasks, or request volume for detail.",
			r.TotalRequests, r.OpenRequests, r.ResolvedTotal, r.SLACompliance, r.AvgCSAT), nil
	}
}

func sumCounts(cs []Count) int {
	n := 0
	for _, c := range cs {
		n += c.Value
	}
	return n
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
