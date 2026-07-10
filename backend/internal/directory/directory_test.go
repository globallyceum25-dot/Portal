package directory

import "testing"

func TestGenerate_Deterministic(t *testing.T) {
	a := New(140).roster
	b := New(140).roster
	if len(a) != 140 {
		t.Fatalf("want 140 employees, got %d", len(a))
	}
	for i := range a {
		if a[i].Name != b[i].Name || a[i].EmpCode != b[i].EmpCode {
			t.Fatalf("roster not deterministic at %d: %q/%q vs %q/%q", i, a[i].Name, a[i].EmpCode, b[i].Name, b[i].EmpCode)
		}
		if len(a[i].Tags) != 2 || (a[i].Category != "Management" && a[i].Category != "Non-Management") {
			t.Fatalf("employee %d has bad tags/category: %+v", i, a[i])
		}
	}
}

func TestSearch_FilterAndPaginate(t *testing.T) {
	d := New(140)

	// Page size is respected and pagination math is sane.
	r := d.Search(Query{Page: 1, PageSize: 12})
	if len(r.Employees) != 12 || r.Grand != 140 || r.Total != 140 {
		t.Fatalf("page1: got %d rows, total %d, grand %d", len(r.Employees), r.Total, r.Grand)
	}
	if r.Pages != 12 { // ceil(140/12) = 12
		t.Fatalf("want 12 pages, got %d", r.Pages)
	}

	// Department filter narrows results and every returned row matches.
	eng := d.Search(Query{Dept: "Engineering", PageSize: 100})
	if eng.Total == 0 || eng.Total >= 140 {
		t.Fatalf("engineering filter suspicious: total %d", eng.Total)
	}
	for _, e := range eng.Employees {
		if e.Department != "Engineering" {
			t.Fatalf("dept filter leaked: %s", e.Department)
		}
	}

	// Tag filter (Management) returns only managers.
	mgmt := d.Search(Query{Tag: "Management", PageSize: 100})
	for _, e := range mgmt.Employees {
		if e.Category != "Management" {
			t.Fatalf("tag filter leaked non-manager: %s", e.Name)
		}
	}

	// Facets are present and count into the search set.
	if len(r.Departments) == 0 {
		t.Fatalf("expected department facets")
	}
}

func TestSearch_FreeText(t *testing.T) {
	d := New(140)
	// A query for a known designation should return matches, all relevant.
	r := d.Search(Query{Q: "designer", PageSize: 100})
	if r.Total == 0 {
		t.Fatalf("expected designer matches")
	}
	for _, e := range r.Employees {
		if !e.matches("designer") {
			t.Fatalf("free-text leaked: %s / %s", e.Name, e.Designation)
		}
	}
}
