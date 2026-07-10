// Package bot is the Portal Bot / conversational assistant (spec §13.5). It
// answers employee questions about live portal data using a tool-calling
// pattern: the bot has NO direct database access. It selects one of a fixed set
// of tools, each of which calls the store through the same RBAC-scoped seam the
// REST handlers use, and the factual answer is composed in Go from the tool's
// results. This is the grounding guarantee (spec §13.5): the model chooses which
// tool to run and extracts arguments, but never authors portal facts — so a
// ticket status the bot reports is always a real one, never hallucinated.
//
// The model that does the routing plugs in behind the same config seam as the
// rest of the backend: a keyword Heuristic engine ships by default; the
// NIM-backed GLM engine (spec §13.5) replaces it when NVIDIA NIM is configured.
// RBAC is enforced here, above the tools: an Employee can only ever reach their
// own job cards and tasks, while queue summaries require a staff/admin role.
package bot

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"lyceumconnect/backend/internal/config"
	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/store"
)

// ToolSpec describes a tool to the routing engine (name + when to use it +
// the argument it accepts). Kept model-agnostic so both engines share it.
type ToolSpec struct {
	Name string `json:"name"`
	Desc string `json:"desc"`
	Arg  string `json:"arg,omitempty"` // name of the single free-text argument, if any
}

// ToolCall is the engine's decision: which tool, with what argument.
type ToolCall struct {
	Tool string `json:"tool"`
	Arg  string `json:"arg,omitempty"`
}

// Answer is a grounded bot reply: the composed text, the tools that produced it,
// and any structured citations (e.g. job-card refs, document links) the UI can
// render as chips.
type Answer struct {
	Text      string     `json:"text"`
	Tools     []string   `json:"tools"`
	Citations []Citation `json:"citations,omitempty"`
	Engine    string     `json:"engine"`
}

// Citation is a pointer back to the portal record the answer is grounded in.
type Citation struct {
	Label string `json:"label"`
	Ref   string `json:"ref,omitempty"`  // e.g. REQ-2026-0001
	Link  string `json:"link,omitempty"` // relative portal URL or external doc URL
}

// Engine selects a tool for a question. It is the only place a model is used;
// everything factual is produced by the tools below.
type Engine interface {
	Name() string
	Route(ctx context.Context, question string, tools []ToolSpec) (ToolCall, error)
}

// Assistant orchestrates routing → tool execution → grounded answer.
type Assistant struct {
	store  store.Store
	engine Engine
}

func New(s store.Store, e Engine) *Assistant { return &Assistant{store: s, engine: e} }

func (a *Assistant) Engine() string { return a.engine.Name() }

// specs is the fixed catalog exposed to the routing engine.
func specs() []ToolSpec {
	return []ToolSpec{
		{"my_requests", "List the user's own service requests / tickets and their current status.", ""},
		{"request_status", "Get the status of one specific request by its reference number.", "ref"},
		{"my_tasks", "Summarise the user's open tasks, including those generated from meetings.", ""},
		{"search_knowledge", "Find Knowledge Center documents (SOPs, policies, procedures) about a topic.", "query"},
		{"queue_summary", "For staff/admins: count of requests waiting in the IT/ZTE/department queues.", "queue"},
		{"navigation", "Explain how to use a portal feature (e.g. how to submit an IT request).", "topic"},
	}
}

// Ask answers one question for a specific user, enforcing RBAC.
func (a *Assistant) Ask(ctx context.Context, u models.User, question string) (Answer, error) {
	call, err := a.engine.Route(ctx, question, specs())
	if err != nil {
		call = ToolCall{Tool: "navigation", Arg: question}
	}
	ans := Answer{Engine: a.engine.Name(), Tools: []string{call.Tool}}

	switch call.Tool {
	case "my_requests":
		return a.myRequests(ctx, u, ans)
	case "request_status":
		return a.requestStatus(ctx, u, call.Arg, ans)
	case "my_tasks":
		return a.myTasks(ctx, u, ans)
	case "search_knowledge":
		return a.searchKnowledge(ctx, u, call.Arg, ans)
	case "queue_summary":
		return a.queueSummary(ctx, u, call.Arg, ans)
	default:
		ans.Tools = []string{"navigation"}
		ans.Text = navigation(call.Arg)
		return ans, nil
	}
}

// --- Tools. Each reads only what the caller is authorized to see. ---

func (a *Assistant) myRequests(ctx context.Context, u models.User, ans Answer) (Answer, error) {
	cards, err := a.store.ListJobCardsByRequester(ctx, u.ID)
	if err != nil {
		return ans, err
	}
	if len(cards) == 0 {
		ans.Text = "You have no service requests on record yet. You can raise one from the Service Catalog."
		return ans, nil
	}
	open := 0
	b := &strings.Builder{}
	fmt.Fprintf(b, "You have %d request(s):", len(cards))
	for i, c := range cards {
		if i >= 5 {
			fmt.Fprintf(b, "\n…and %d more.", len(cards)-5)
			break
		}
		fmt.Fprintf(b, "\n• %s — %s (%s)", c.Ref, c.ServiceName, humanStatus(c.Status))
		if c.Status != models.StatusCompleted && c.Status != models.StatusRejected {
			open++
		}
		ans.Citations = append(ans.Citations, Citation{Label: c.Ref + " · " + c.ServiceName, Ref: c.Ref, Link: "request-tracking.html"})
	}
	if open > 0 {
		fmt.Fprintf(b, "\n\n%d of these are still open.", open)
	}
	ans.Text = b.String()
	return ans, nil
}

func (a *Assistant) requestStatus(ctx context.Context, u models.User, ref string, ans Answer) (Answer, error) {
	ref = strings.ToUpper(strings.TrimSpace(ref))
	if ref == "" {
		return a.myRequests(ctx, u, ans) // no ref given — fall back to the list
	}
	card, err := a.store.GetJobCard(ctx, ref)
	if err != nil || card == nil {
		ans.Text = fmt.Sprintf("I couldn't find a request with reference %s.", ref)
		return ans, nil
	}
	// RBAC: requesters see their own; staff/admins see cards in their tenant.
	if card.RequesterID != u.ID && !(canSeeQueues(u.Role) && sameTenant(u, card.TenantID)) {
		ans.Text = fmt.Sprintf("You don't have access to request %s.", ref)
		return ans, nil
	}
	b := &strings.Builder{}
	fmt.Fprintf(b, "%s — %s is currently %s.", card.Ref, card.ServiceName, humanStatus(card.Status))
	if card.Approval.Required {
		if card.Approval.Decision != "" {
			fmt.Fprintf(b, " Approval: %s.", card.Approval.Decision)
		} else {
			b.WriteString(" It is awaiting HOD approval.")
		}
	}
	if !card.SLADeadline.IsZero() && card.Status != models.StatusCompleted {
		fmt.Fprintf(b, " SLA target: %s.", card.SLADeadline.Format("02 Jan 15:04"))
	}
	if n := len(card.Timeline); n > 0 {
		last := card.Timeline[n-1]
		if last.Note != "" {
			fmt.Fprintf(b, " Latest update: %q.", last.Note)
		}
	}
	ans.Citations = append(ans.Citations, Citation{Label: card.Ref, Ref: card.Ref, Link: "request-tracking.html"})
	ans.Text = b.String()
	return ans, nil
}

func (a *Assistant) myTasks(ctx context.Context, u models.User, ans Answer) (Answer, error) {
	tasks, err := a.store.ListTasks(ctx, u.TenantID)
	if err != nil {
		return ans, err
	}
	var mine []models.Task
	for _, t := range tasks {
		if t.CreatedByID == u.ID || matchesName(t.AssigneeName, u.Name) {
			mine = append(mine, t)
		}
	}
	if len(mine) == 0 {
		ans.Text = "You have no open tasks. Tasks generated from meeting minutes will appear here automatically."
		return ans, nil
	}
	todo, prog, done := 0, 0, 0
	b := &strings.Builder{}
	for _, t := range mine {
		switch t.Status {
		case models.TaskDone:
			done++
		case models.TaskInProgress:
			prog++
		default:
			todo++
		}
	}
	fmt.Fprintf(b, "You have %d task(s): %d to do, %d in progress, %d done.", len(mine), todo, prog, done)
	shown := 0
	for _, t := range mine {
		if t.Status == models.TaskDone {
			continue
		}
		if shown >= 4 {
			break
		}
		fmt.Fprintf(b, "\n• %s (%s)", t.Title, humanTaskStatus(t.Status))
		shown++
	}
	ans.Citations = append(ans.Citations, Citation{Label: "Open in Tasks Manager", Link: "tasks.html"})
	ans.Text = b.String()
	return ans, nil
}

func (a *Assistant) searchKnowledge(ctx context.Context, u models.User, query string, ans Answer) (Answer, error) {
	docs, err := a.store.ListDocuments(ctx, u.TenantID)
	if err != nil {
		return ans, err
	}
	terms := tokenize(query)
	type scored struct {
		d     models.Document
		score int
	}
	var hits []scored
	for _, d := range docs {
		hay := strings.ToLower(d.Title + " " + d.DocType + " " + strings.Join(d.Tags, " "))
		s := 0
		for _, t := range terms {
			if strings.Contains(hay, t) {
				s++
			}
		}
		if s > 0 {
			hits = append(hits, scored{d, s})
		}
	}
	sort.Slice(hits, func(i, j int) bool { return hits[i].score > hits[j].score })
	if len(hits) == 0 {
		ans.Text = "I couldn't find a Knowledge Center document matching that. Try the Knowledge Center search, or rephrase your topic."
		ans.Citations = append(ans.Citations, Citation{Label: "Browse Knowledge Center", Link: "knowledge-center.html"})
		return ans, nil
	}
	b := &strings.Builder{}
	b.WriteString("Here are the most relevant documents:")
	for i, h := range hits {
		if i >= 4 {
			break
		}
		fmt.Fprintf(b, "\n• %s (%s, v%s)", h.d.Title, h.d.DocType, h.d.Version)
		link := h.d.URL
		if link == "" {
			link = "knowledge-center.html"
		}
		ans.Citations = append(ans.Citations, Citation{Label: h.d.Title, Link: link})
	}
	ans.Text = b.String()
	return ans, nil
}

func (a *Assistant) queueSummary(ctx context.Context, u models.User, queue string, ans Answer) (Answer, error) {
	if !canSeeQueues(u.Role) {
		ans.Text = "Queue summaries are available to IT reviewers, technicians, managers and admins only."
		return ans, nil
	}
	// Group Super Admin sees all tenants; others are scoped to their own.
	scope := u.TenantID
	if u.Role == models.RoleGroupSuperAdmin {
		scope = ""
	}
	wanted := parseQueue(queue)
	queues := []models.Queue{models.QueueLGHIT, models.QueueZTE, models.QueueDepartment}
	if wanted != "" {
		queues = []models.Queue{wanted}
	}
	b := &strings.Builder{}
	b.WriteString("Queue status:")
	for _, q := range queues {
		cards, err := a.store.ListJobCardsByQueue(ctx, scope, q)
		if err != nil {
			return ans, err
		}
		unack := 0
		for _, c := range cards {
			if c.Status != models.StatusAcknowledged && c.Status != models.StatusInProgress && c.Status != models.StatusCompleted {
				unack++
			}
		}
		fmt.Fprintf(b, "\n• %s — %d waiting (%d unacknowledged)", queueLabel(q), len(cards), unack)
	}
	ans.Citations = append(ans.Citations, Citation{Label: "Open queues", Link: "request-tracking.html"})
	ans.Text = b.String()
	return ans, nil
}

// --- RBAC + formatting helpers ---

func canSeeQueues(r models.Role) bool {
	switch r {
	case models.RoleLGHITReviewer, models.RoleZTETechnician, models.RoleHODManager,
		models.RoleCompanyAdmin, models.RoleGroupSuperAdmin:
		return true
	}
	return false
}

func sameTenant(u models.User, tenantID string) bool {
	return u.Role == models.RoleGroupSuperAdmin || u.TenantID == tenantID
}

func matchesName(assignee, userName string) bool {
	if assignee == "" || userName == "" {
		return false
	}
	a := strings.ToLower(assignee)
	// Match on first name too, since meeting extraction often yields first names.
	first := strings.ToLower(strings.Fields(userName)[0])
	return strings.Contains(strings.ToLower(userName), a) || strings.Contains(a, first)
}

func humanStatus(s models.JobStatus) string {
	return strings.ReplaceAll(string(s), "_", " ")
}

func humanTaskStatus(s models.TaskStatus) string {
	switch s {
	case models.TaskInProgress:
		return "in progress"
	case models.TaskDone:
		return "done"
	default:
		return "to do"
	}
}

func parseQueue(s string) models.Queue {
	switch {
	case containsAny(s, "zte"):
		return models.QueueZTE
	case containsAny(s, "it", "lgh", "review"):
		return models.QueueLGHIT
	case containsAny(s, "dept", "department", "facility", "hr"):
		return models.QueueDepartment
	}
	return ""
}

func queueLabel(q models.Queue) string {
	switch q {
	case models.QueueLGHIT:
		return "LGH IT Review"
	case models.QueueZTE:
		return "ZTE"
	default:
		return "Department"
	}
}

func tokenize(s string) []string {
	var out []string
	for _, w := range strings.FieldsFunc(strings.ToLower(s), func(r rune) bool {
		return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
	}) {
		if len(w) > 2 && !stopword[w] {
			out = append(out, w)
		}
	}
	return out
}

var stopword = map[string]bool{
	"the": true, "for": true, "how": true, "what": true, "and": true, "does": true,
	"can": true, "you": true, "get": true, "our": true, "was": true, "are": true,
}

func containsAny(s string, subs ...string) bool {
	s = strings.ToLower(s)
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// navigation answers "how do I …" questions from a small static playbook.
func navigation(topic string) string {
	t := strings.ToLower(topic)
	switch {
	case containsAny(t, "zte", "forward"):
		return "IT requests are raised from the Service Catalog. Choose an IT service and submit — LGH IT reviews it first, then forwards it to ZTE if hands-on work is needed. You can track the LGH IT → ZTE handoff on the request's timeline in My Requests."
	case containsAny(t, "it request", "it support", "ticket", "raise", "submit"):
		return "To submit an IT request: open the Service Catalog, pick the relevant IT service, fill in the form and submit. A Job Card is created automatically and you can follow it under My Requests."
	case containsAny(t, "vehicle", "booking", "facility"):
		return "To book a company vehicle: open the Service Catalog → Company Vehicle Booking, enter your dates and destination, and submit. It routes to the Facility team."
	case containsAny(t, "leave", "hr"):
		return "Leave requests are under the Service Catalog → Leave Request. They route to your HOD for approval before HR processing."
	case containsAny(t, "knowledge", "policy", "sop", "procedure", "document"):
		return "Company SOPs and policies live in the Knowledge Center. Use its search, or ask me about a specific topic and I'll surface the matching documents."
	case containsAny(t, "meeting", "transcri", "minutes", "task"):
		return "Use the Meeting Transcriber to capture minutes; it extracts action items into the Tasks Manager automatically. Ask me to summarise your open tasks any time."
	default:
		return "I can help you check the status of your requests, summarise your tasks, find Knowledge Center documents, and explain how to use portal features. What would you like to do?"
	}
}

// Pick returns the NIM routing engine when configured, else the heuristic one.
func Pick(cfg config.Config) Engine {
	if cfg.NIM.Configured() {
		return NewNIMEngine(cfg.NIM)
	}
	return Heuristic{}
}

// Heuristic routes by keyword — always available, zero dependencies.
type Heuristic struct{}

func (Heuristic) Name() string { return "heuristic" }

func (Heuristic) Route(_ context.Context, question string, _ []ToolSpec) (ToolCall, error) {
	q := strings.ToLower(question)
	if ref := findRef(question); ref != "" {
		return ToolCall{Tool: "request_status", Arg: ref}, nil
	}
	switch {
	case containsAny(q, "how many", "queue", "unacknowledged", "backlog", "waiting"):
		return ToolCall{Tool: "queue_summary", Arg: q}, nil
	case containsAny(q, "my task", "my tasks", "action item", "to-do", "to do", "todo"):
		return ToolCall{Tool: "my_tasks"}, nil
	case containsAny(q, "my request", "my ticket", "my it", "status of my", "approved", "my requests"):
		return ToolCall{Tool: "my_requests"}, nil
	case containsAny(q, "policy", "procedure", "sop", "how do i", "guide", "document", "vehicle", "leave"):
		if containsAny(q, "how do i", "how to") {
			return ToolCall{Tool: "navigation", Arg: q}, nil
		}
		return ToolCall{Tool: "search_knowledge", Arg: q}, nil
	case containsAny(q, "request", "ticket", "status"):
		return ToolCall{Tool: "my_requests"}, nil
	default:
		return ToolCall{Tool: "navigation", Arg: q}, nil
	}
}

// findRef pulls a REQ-YYYY-NNNN reference out of free text, if present.
func findRef(s string) string {
	up := strings.ToUpper(s)
	i := strings.Index(up, "REQ-")
	if i < 0 {
		return ""
	}
	end := i
	for end < len(up) && (up[end] == '-' || (up[end] >= '0' && up[end] <= '9') || (up[end] >= 'A' && up[end] <= 'Z')) {
		end++
	}
	return up[i:end]
}
