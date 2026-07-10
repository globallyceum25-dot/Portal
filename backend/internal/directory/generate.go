package directory

import (
	"fmt"
	"strings"
	"time"
)

// Deterministic roster generation. A tiny splitmix64-style hash turns a stable
// index into repeatable "random" field choices, so the roster is identical on
// every startup without persisting anything.

var firstNames = []string{
	"Toni", "Wade", "Leslie", "Robert", "Jacob", "Jane", "Esther", "Jerome",
	"Kathryn", "Courtney", "Devon", "Priya", "Ahmed", "Fatima", "Noor", "David",
	"Aisha", "Michael", "Lisa", "James", "Sofia", "Omar", "Hana", "Ravi",
	"Mei", "Carlos", "Zara", "Ibrahim", "Elena", "Kofi", "Yuki", "Amara",
	"Dilan", "Nadia", "Sanjay", "Leah", "Marcus", "Tara", "Yusuf", "Ingrid",
}

var lastNames = []string{
	"Kross", "Warren", "Alexander", "Fox", "Jones", "Cooper", "Howard", "Bell",
	"Murphy", "Henry", "Lane", "Sharma", "Al-Rashid", "Al-Hassan", "Abdullah",
	"Lee", "Mohamed", "Chen", "Thompson", "Wilson", "Rossi", "Khalid", "Silva",
	"Patel", "Tanaka", "Mendez", "Okafor", "Nguyen", "Costa", "Mensah",
}

// designation → (department, function, role-tag). Category is derived from the
// designation seniority.
type role struct {
	title, dept, function, tag string
	senior                     bool
}

var roles = []role{
	{"Product Designer", "Design", "Product", "Designer", true},
	{"UX/UI Designer", "Design", "Product", "Designer", false},
	{"Graphic Designer", "Design", "Brand", "Designer", false},
	{"Web Designer", "Design", "Web", "Designer", false},
	{"iOS Developer", "Engineering", "Mobile", "Developer", false},
	{"Frontend Developer", "Engineering", "Web", "Developer", false},
	{"Backend Developer", "Engineering", "Platform", "Developer", false},
	{"DevOps Engineer", "Engineering", "Infrastructure", "Developer", true},
	{"Engineering Manager", "Engineering", "Platform", "Developer", true},
	{"HR Officer", "Human Resources", "People Ops", "HR", false},
	{"HR Business Partner", "Human Resources", "People Ops", "HR", true},
	{"Finance Officer", "Finance", "Accounting", "Finance", false},
	{"Finance Director", "Finance", "Accounting", "Finance", true},
	{"Marketing Manager", "Marketing", "Growth", "Marketing", true},
	{"Content Strategist", "Marketing", "Growth", "Marketing", false},
	{"Operations Lead", "Operations", "Delivery", "Operations", true},
	{"IT Support Analyst", "Information Technology", "Support", "IT", false},
	{"Network Engineer", "Information Technology", "Infrastructure", "IT", false},
	{"QA Engineer", "Engineering", "Quality", "Developer", false},
	{"Data Analyst", "Operations", "Analytics", "Analyst", false},
}

var locations = []string{
	"HQ — Main Building", "HQ — Block A, Floor 2", "Campus A", "Campus B", "Remote",
}

func generate(n int) []Employee {
	base := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	out := make([]Employee, 0, n)
	for i := 0; i < n; i++ {
		h := hash(uint64(i) + 1)
		fn := firstNames[int(h%uint64(len(firstNames)))]
		ln := lastNames[int((h>>8)%uint64(len(lastNames)))]
		r := roles[int((h>>16)%uint64(len(roles)))]
		loc := locations[int((h>>24)%uint64(len(locations)))]

		category := "Non-Management"
		if r.senior {
			category = "Management"
		}

		// Joining date spread across ~5 years, formatted like the reference.
		days := int((h >> 32) % (5 * 365))
		joined := base.AddDate(0, 0, days)

		year := 2020 + int((h>>40)%5)
		code := fmt.Sprintf("EMP-%04d-%04d", year, 1000+i*7%9000)

		email := strings.ToLower(fmt.Sprintf("%s.%s@lyceum.edu", fn, strings.ReplaceAll(ln, "-", "")))
		phone := fmt.Sprintf("+968 24%02d %04d", 10+int((h>>44)%80), int((h>>50)%9000)+1000)

		out = append(out, Employee{
			ID:          fmt.Sprintf("emp_%03d", i+1),
			Name:        fn + " " + ln,
			Designation: r.title,
			Department:  r.dept,
			Function:    r.function,
			Category:    category,
			Tags:        []string{r.tag, category},
			EmpCode:     code,
			JoiningDate: joined.Format("02-Jan-2006"),
			Email:       email,
			Phone:       phone,
			Location:    loc,
			ReportsTo:   reportsTo(r, h),
			Initials:    initials(fn, ln),
			Hue:         int(h % 360),
			Online:      h%3 == 0,
		})
	}
	return out
}

func reportsTo(r role, h uint64) string {
	if r.senior {
		return "Office of the CEO"
	}
	// Point at a plausible manager title in the same department.
	for _, m := range roles {
		if m.dept == r.dept && m.senior {
			return m.title
		}
	}
	return "Department Head"
}

func initials(fn, ln string) string {
	i := ""
	if fn != "" {
		i += string([]rune(fn)[0])
	}
	if ln != "" {
		i += string([]rune(ln)[0])
	}
	return strings.ToUpper(i)
}

// hash is a splitmix64 finalizer — cheap, deterministic, well-distributed.
func hash(x uint64) uint64 {
	x += 0x9E3779B97F4A7C15
	x = (x ^ (x >> 30)) * 0xBF58476D1CE4E5B9
	x = (x ^ (x >> 27)) * 0x94D049BB133111EB
	return x ^ (x >> 31)
}
