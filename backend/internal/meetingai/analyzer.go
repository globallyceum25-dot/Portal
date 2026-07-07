// Package meetingai is the post-transcription AI pipeline (spec §5): it turns a
// meeting transcript into a summary, key points and action items.
//
// Analyzer is an interface so the production model (NVIDIA Nemotron via NIM,
// spec §13.1) plugs in behind the same seam as the always-available heuristic
// analyzer — the config-gated swap used throughout the backend. The Sinhala path
// (Google STT/Translate, §13.1) sits upstream in the browser/STT stage; by the
// time text reaches here it is English working copy.
package meetingai

import (
	"context"
	"regexp"
	"strings"
)

// Analysis is the structured output of the pipeline.
type Analysis struct {
	Summary   string
	KeyPoints []string
	Actions   []Action
}

// Action is an extracted to-do with an optional assignee.
type Action struct {
	Text     string
	Assignee string
}

// Analyzer derives structured meeting intelligence from transcript text.
type Analyzer interface {
	Name() string
	Analyze(ctx context.Context, transcript string) (Analysis, error)
}

// Heuristic is a zero-dependency analyzer: it splits the transcript into
// sentences, surfaces the most informative as key points, and extracts action
// items via cue phrases and "Name will/to …" patterns. Always available; the
// Nemotron analyzer replaces it when NVIDIA NIM is configured.
type Heuristic struct{}

func (Heuristic) Name() string { return "heuristic" }

var (
	sentenceSplit = regexp.MustCompile(`(?:[.!?]\s+|\n+)`)
	// "Alice will send the report", "Bob to follow up", "@Carol: review"
	assigneeCue = regexp.MustCompile(`^\s*(?:@)?([A-Z][a-zA-Z]+)(?:\s+[A-Z][a-zA-Z]+)?\s+(?:will|to|should|is going to|needs to)\s+(.+)`)
	actionCue   = regexp.MustCompile(`(?i)\b(action item|todo|to-do|follow[- ]up|please|let's|we (?:need|should|must)|assign|deadline|by (?:monday|tuesday|wednesday|thursday|friday|next week|eod|tomorrow))\b`)
)

func (Heuristic) Analyze(_ context.Context, transcript string) (Analysis, error) {
	raw := sentenceSplit.Split(strings.TrimSpace(transcript), -1)
	var sentences []string
	for _, s := range raw {
		if s = strings.TrimSpace(s); len(s) > 3 {
			sentences = append(sentences, s)
		}
	}

	var actions []Action
	var keyPoints []string
	seen := map[string]bool{}
	for _, s := range sentences {
		if m := assigneeCue.FindStringSubmatch(s); m != nil {
			actions = append(actions, Action{Assignee: m[1], Text: strings.TrimRight(m[2], ".")})
			continue
		}
		if actionCue.MatchString(s) {
			actions = append(actions, Action{Text: s})
			continue
		}
		if len(keyPoints) < 5 && !seen[s] {
			keyPoints = append(keyPoints, s)
			seen[s] = true
		}
	}

	summary := "Discussion covered " + string(rune(len(sentences)+'0')) + " points."
	if len(sentences) > 0 {
		n := len(sentences)
		summary = "The meeting covered " + itoa(n) + " discussion points"
		if len(actions) > 0 {
			summary += " and produced " + itoa(len(actions)) + " action item(s)"
		}
		summary += ". " + firstN(sentences[0], 160)
	}

	return Analysis{Summary: summary, KeyPoints: keyPoints, Actions: actions}, nil
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}

func firstN(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
