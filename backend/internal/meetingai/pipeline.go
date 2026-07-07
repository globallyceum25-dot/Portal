package meetingai

import (
	"context"

	"lyceumconnect/backend/internal/models"
	"lyceumconnect/backend/internal/pii"
	"lyceumconnect/backend/internal/store"
)

// Pipeline runs the full meeting → tasks flow (spec §5): analyze the transcript,
// persist the meeting (with a PII-masked transcript), and auto-create a Task for
// each extracted action item, linked back to the meeting.
type Pipeline struct {
	store    store.Store
	analyzer Analyzer
}

func NewPipeline(s store.Store, a Analyzer) *Pipeline {
	return &Pipeline{store: s, analyzer: a}
}

func (p *Pipeline) Analyzer() string { return p.analyzer.Name() }

// Process analyzes the RAW transcript (names intact for assignment), then stores
// the meeting with a masked transcript and creates the tasks.
func (p *Pipeline) Process(ctx context.Context, actor models.User, title, language, transcript string) (*models.Meeting, []models.Task, error) {
	an, err := p.analyzer.Analyze(ctx, transcript)
	if err != nil {
		return nil, nil, err
	}

	meeting := &models.Meeting{
		TenantID:    actor.TenantID,
		Title:       title,
		Language:    language,
		Transcript:  pii.Mask(transcript), // minimise PII before persistence
		Summary:     an.Summary,
		KeyPoints:   an.KeyPoints,
		Analyzer:    p.analyzer.Name(),
		CreatedByID: actor.ID,
	}
	for _, a := range an.Actions {
		meeting.ActionItems = append(meeting.ActionItems, models.ActionItem{Text: a.Text, Assignee: a.Assignee})
	}

	created, err := p.store.CreateMeeting(ctx, meeting)
	if err != nil {
		return nil, nil, err
	}

	var tasks []models.Task
	for _, a := range an.Actions {
		t, err := p.store.CreateTask(ctx, &models.Task{
			TenantID:        actor.TenantID,
			Title:           a.Text,
			Status:          models.TaskTodo,
			Priority:        "Normal",
			AssigneeName:    a.Assignee,
			SourceMeetingID: created.ID,
			CreatedByID:     actor.ID,
		})
		if err != nil {
			continue
		}
		created.TaskIDs = append(created.TaskIDs, t.ID)
		tasks = append(tasks, *t)
	}

	// Persist the task links back onto the meeting.
	if len(created.TaskIDs) > 0 {
		_ = p.store.UpdateMeeting(ctx, created)
	}
	return created, tasks, nil
}
