package slack

import (
	"context"
	"errors"
	"testing"
)

func TestRoute(t *testing.T) {
	cases := []struct {
		name string
		e    Event
		want string
	}{
		{"explicit override", Event{Channel: ChKitchen, Kind: "whatever"}, ChKitchen},
		{"announcement by kind", Event{Kind: "announcement:Urgent"}, ChAnnouncements},
		{"approval by kind", Event{Kind: "approval_needed"}, ChApprovals},
		{"incident by kind", Event{Kind: "incident.reported"}, ChSystemAlerts},
		{"HR by category", Event{Kind: "submitted", Category: "HR"}, ChHR},
		{"facility by category", Event{Kind: "submitted", Category: "Facility"}, ChFacilities},
		{"IT by category", Event{Kind: "submitted", Category: "IT Support"}, ChIT},
		{"default is IT", Event{Kind: "submitted", Category: "Unknown"}, ChIT},
	}
	for _, c := range cases {
		if got := Route(c.e); got != c.want {
			t.Errorf("%s: Route()=%q want %q", c.name, got, c.want)
		}
	}
}

// flakyTransport fails the first failN calls, then succeeds.
type flakyTransport struct {
	failN int
	calls int
}

func (f *flakyTransport) Name() string { return "flaky" }
func (f *flakyTransport) Send(_ context.Context, _ string, _ Event) error {
	f.calls++
	if f.calls <= f.failN {
		return errors.New("transient")
	}
	return nil
}

func TestHubRetrySucceedsAfterTransientFailures(t *testing.T) {
	ft := &flakyTransport{failN: 2} // fail twice, succeed on the 3rd
	h := NewHub(ft)
	h.Publish(context.Background(), Event{Kind: "submitted", Category: "IT"})
	if ft.calls != 3 {
		t.Fatalf("expected 3 attempts (2 fail + 1 success), got %d", ft.calls)
	}
}

func TestHubRetryStopsAtMax(t *testing.T) {
	ft := &flakyTransport{failN: 99} // always fails
	h := NewHub(ft)
	h.Publish(context.Background(), Event{Kind: "submitted"})
	if ft.calls != h.maxRetries {
		t.Fatalf("expected %d attempts, got %d", h.maxRetries, ft.calls)
	}
}
