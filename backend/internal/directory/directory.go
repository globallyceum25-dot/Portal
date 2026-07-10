// Package directory is the Employee Directory (spec §"Employee Directory"): a
// read-only, HRIS-sourced roster of staff. In production the entries sync from
// the HRIS/Entra; here the roster is generated deterministically at startup so
// the API — and the motion-rich directory UI on top of it — has a realistic
// 140-person dataset to page, search and filter through with zero external
// dependencies. Generation is seeded, so the same roster comes back every run.
package directory

import (
	"sort"
	"strings"
)

// Employee is one directory entry. Fields mirror the spec's directory record
// (name, designation, department, company, email, phone, office, employee ID,
// reporting manager) plus the tag/category chips the card UI renders.
type Employee struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Designation string   `json:"designation"`
	Department  string   `json:"department"`
	Function    string   `json:"function"`
	Category    string   `json:"category"` // "Management" | "Non-Management"
	Tags        []string `json:"tags"`     // e.g. ["Designer", "Management"]
	EmpCode     string   `json:"emp_code"`
	JoiningDate string   `json:"joining_date"` // "02-Jan-2006"
	Email       string   `json:"email"`
	Phone       string   `json:"phone"`
	Location    string   `json:"location"`
	ReportsTo   string   `json:"reports_to"`
	Initials    string   `json:"initials"`
	Hue         int      `json:"hue"` // avatar gradient hue (0-359), stable per person
	Online      bool     `json:"online"`
}

// Facet is a labelled count used to drive filter chips (e.g. departments).
type Facet struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// Result is a paginated query response.
type Result struct {
	Employees   []Employee `json:"employees"`
	Total       int        `json:"total"`       // matches before pagination
	Grand       int        `json:"grand_total"` // whole roster size
	Page        int        `json:"page"`
	PageSize    int        `json:"page_size"`
	Pages       int        `json:"pages"`
	Departments []Facet    `json:"departments"`
}

// Query filters/sorts/paginates the roster.
type Query struct {
	Q        string
	Dept     string
	Tag      string
	Page     int
	PageSize int
}

// Directory holds the generated roster.
type Directory struct{ roster []Employee }

// New builds a directory of n deterministic employees.
func New(n int) *Directory { return &Directory{roster: generate(n)} }

// Get returns a single employee by id.
func (d *Directory) Get(id string) (Employee, bool) {
	for _, e := range d.roster {
		if e.ID == id {
			return e, true
		}
	}
	return Employee{}, false
}

// Search applies the query and returns a page plus department facets computed
// over the current (q/tag-filtered) result set.
func (d *Directory) Search(q Query) Result {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 12
	}
	term := strings.ToLower(strings.TrimSpace(q.Q))
	tag := strings.ToLower(strings.TrimSpace(q.Tag))

	// First narrow by free-text + tag (department facets are computed on this
	// set so chip counts reflect the active search).
	var searched []Employee
	for _, e := range d.roster {
		if term != "" && !e.matches(term) {
			continue
		}
		if tag != "" && !e.hasTag(tag) {
			continue
		}
		searched = append(searched, e)
	}

	deptCounts := map[string]int{}
	for _, e := range searched {
		deptCounts[e.Department]++
	}

	// Then apply the department filter for the actual rows returned.
	var matched []Employee
	for _, e := range searched {
		if q.Dept != "" && !strings.EqualFold(e.Department, q.Dept) {
			continue
		}
		matched = append(matched, e)
	}

	total := len(matched)
	pages := (total + q.PageSize - 1) / q.PageSize
	start := (q.Page - 1) * q.PageSize
	if start > total {
		start = total
	}
	end := start + q.PageSize
	if end > total {
		end = total
	}

	facets := make([]Facet, 0, len(deptCounts))
	for label, c := range deptCounts {
		facets = append(facets, Facet{Label: label, Count: c})
	}
	sort.Slice(facets, func(i, j int) bool {
		if facets[i].Count != facets[j].Count {
			return facets[i].Count > facets[j].Count
		}
		return facets[i].Label < facets[j].Label
	})

	page := matched[start:end]
	if page == nil {
		page = []Employee{}
	}
	return Result{
		Employees:   page,
		Total:       total,
		Grand:       len(d.roster),
		Page:        q.Page,
		PageSize:    q.PageSize,
		Pages:       pages,
		Departments: facets,
	}
}

func (e Employee) matches(term string) bool {
	return strings.Contains(strings.ToLower(e.Name), term) ||
		strings.Contains(strings.ToLower(e.Designation), term) ||
		strings.Contains(strings.ToLower(e.Department), term) ||
		strings.Contains(strings.ToLower(e.EmpCode), term) ||
		strings.Contains(strings.ToLower(e.Email), term)
}

func (e Employee) hasTag(tag string) bool {
	for _, t := range e.Tags {
		if strings.EqualFold(t, tag) {
			return true
		}
	}
	return false
}
