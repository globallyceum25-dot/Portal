// Package pii provides the PII-masking primitive (spec §13.1). It is applied as
// a pre-storage layer on free-text (request forms, transcripts, CSAT comments)
// so personal data is minimised before it is persisted (PDPA, spec §10).
//
// This regex masker is the always-on baseline. The spec's model-based masker
// (NVIDIA Safety-Guard / GLiNER-PII) plugs in behind the same Mask() seam later.
package pii

import "regexp"

var (
	reEmail = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
	// Sri Lankan mobile / landline, with or without +94.
	rePhone = regexp.MustCompile(`(?:\+94|0)\d{9}`)
	// Sri Lankan NIC: old (9 digits + V/X) and new (12 digits).
	reNIC = regexp.MustCompile(`\b(?:\d{9}[VvXx]|\d{12})\b`)
)

// Mask replaces detected PII with typed placeholders, preserving surrounding
// text so the field stays useful. Order matters: email before phone (emails can
// contain digit runs), NIC before phone.
func Mask(s string) string {
	s = reEmail.ReplaceAllString(s, "[email]")
	s = reNIC.ReplaceAllString(s, "[nic]")
	s = rePhone.ReplaceAllString(s, "[phone]")
	return s
}
