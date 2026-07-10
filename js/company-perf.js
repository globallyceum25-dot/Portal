/* ============================================================
   LYCEUM CONNECT — Company Performance modal
   Opened from the Company Hierarchy (window.openCompanyPerformance).
   Two tabs: an Overview performance dashboard (deterministic
   per-company analytics via LCCharts) and a Processes tab with
   international-standard cross-functional SWIMLANE diagrams
   (BPMN-style: lanes = departments, staged steps, connectors
   with arrowheads, sequential reveal + draw-in animation).
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var overlay, modal, current, activeTab = 'overview', activeProc = 'onboarding';

  /* ---------- deterministic data ---------- */
  function h(x) { x = (x ^ (x >>> 16)) >>> 0; x = Math.imul(x, 2246822519) >>> 0; x = (x ^ (x >>> 13)) >>> 0; x = Math.imul(x, 3266489917) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
  function sh(s) { var x = 0; s = String(s); for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; }
  function initials(name) {
    var w = String(name).replace(/\(private\)|limited|ltd|\.|,/gi, '').trim().split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function data(node) {
    var b = h(sh(node.id));
    var rnd = function (sh2, min, max) { return min + ((h(b + sh2) >>> 3) % (max - min + 1)); };
    var employees = rnd(1, 120, 1200);
    var permanent = Math.round(employees * (0.55 + rnd(2, 0, 20) / 100));
    var contract = Math.round((employees - permanent) * 0.7);
    var probation = employees - permanent - contract;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var work = months.map(function (m, i) { return { date: m, value: 30 + (h(b + 40 + i) % 55) }; });
    var over = months.map(function (m, i) { return { date: m, value: 8 + (h(b + 80 + i) % 26) }; });
    var projects = ['Redesign Finance App', 'Cloud Migration', 'Brand Refresh 2026', 'Mobile App Launch', 'ERP Rollout', 'Data Platform', 'Customer Portal'];
    var first = ['Nicole', 'Fernando', 'Amara', 'Ravi', 'Sofia', 'Omar', 'Mei', 'Leah'];
    var last = ['Foster', 'Agaro', 'Okafor', 'Sharma', 'Rossi', 'Khalid', 'Chen', 'Bell'];
    var pm = first[b % first.length] + ' ' + last[(b >>> 3) % last.length];
    var lead = first[(b >>> 6) % first.length] + ' ' + last[(b >>> 9) % last.length];
    return {
      employees: employees,
      payroll: Math.round(employees * (0.86 + rnd(3, 0, 12) / 100)),
      attendance: rnd(4, 61, 96),
      applicants: rnd(5, 3, 40),
      empUp: rnd(6, 4, 22), payUp: rnd(7, 3, 18), attnDown: rnd(8, 3, 12), appUp: rnd(9, 5, 20),
      work: work, over: over,
      rating: rnd(10, 78, 96),
      employment: [{ label: 'Permanent', value: permanent }, { label: 'Contract', value: contract }, { label: 'Probation', value: Math.max(1, probation) }],
      annualLeave: rnd(11, 24, 40), sickLeave: rnd(12, 40, 90),
      project: { name: projects[b % projects.length], pm: pm, lead: lead, progress: rnd(13, 35, 92), due: 'Oct 24, 2026' },
      topPerf: [
        { n: pm, v: rnd(14, 70, 98) }, { n: lead, v: rnd(15, 60, 95) },
        { n: first[(b >>> 12) % first.length] + ' ' + last[(b >>> 2) % last.length], v: rnd(16, 55, 90) }
      ],
      notes: [
        { t: 'Quarterly OKR review', d: 'Due in 3 days', c: '#EAB308' },
        { t: 'Client demo — ' + projects[(b >>> 1) % projects.length], d: 'Scheduled', c: '#4F6EF7' },
        { t: 'Hiring drive kickoff', d: 'This week', c: '#22C55E' }
      ]
    };
  }

  /* ---------- open / close ---------- */
  function ensure() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'cp-overlay';
    overlay.innerHTML =
      '<div class="cp-modal" role="dialog" aria-modal="true">' +
        '<div class="cp-header">' +
          '<div class="cp-hlogo" id="cpLogo"></div>' +
          '<div class="cp-htext"><div class="cp-hkicker">Company Performance</div><div class="cp-hname" id="cpName">—</div><div class="cp-hmeta" id="cpMeta"></div></div>' +
          '<button class="cp-hclose" id="cpClose" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>' +
        '<div class="cp-tabs" id="cpTabs">' +
          '<button class="cp-tab active" data-tab="overview"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg> Overview</button>' +
          '<button class="cp-tab" data-tab="processes"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/><circle cx="7" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/></svg> Processes</button>' +
          '<span class="cp-tabink" id="cpInk"></span>' +
        '</div>' +
        '<div class="cp-body">' +
          '<div class="cp-pane active" id="cpOverview"></div>' +
          '<div class="cp-pane" id="cpProcesses"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    modal = overlay.querySelector('.cp-modal');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('#cpClose').addEventListener('click', close);
    overlay.querySelector('#cpTabs').addEventListener('click', function (e) {
      var t = e.target.closest('.cp-tab'); if (t) setTab(t.getAttribute('data-tab'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !overlay.classList.contains('open')) return;
      if (currentPop) closePop(); else close();
    });
  }

  function open(node) {
    ensure();
    current = node; activeTab = 'overview';
    var logo = overlay.querySelector('#cpLogo');
    logo.innerHTML = initials(node.name) + (node.logo ? '<img src="' + node.logo + '" onerror="this.remove()">' : '');
    overlay.querySelector('#cpName').textContent = node.name;
    var meta = [];
    if (node.sub) meta.push('<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>' + esc(node.sub) + '</span>');
    if (node.website) meta.push('<a href="' + esc(node.website) + '" target="_blank" rel="noopener"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>Website</a>');
    overlay.querySelector('#cpMeta').innerHTML = meta.join('');
    renderOverview(node);
    var proc = overlay.querySelector('#cpProcesses'); proc.innerHTML = ''; delete proc.dataset.built; // lazy per company
    setTab('overview', true);
    // Force a reflow, then open — reliable even when rAF is throttled.
    void overlay.offsetWidth;
    setTimeout(function () { overlay.classList.add('open'); moveInk(); setTimeout(animateOverview, 60); }, 10);
  }
  function close() { closePop(); overlay.classList.remove('open'); }

  function setTab(tab, immediate) {
    closePop();
    activeTab = tab;
    Array.prototype.forEach.call(overlay.querySelectorAll('.cp-tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    overlay.querySelector('#cpOverview').classList.toggle('active', tab === 'overview');
    overlay.querySelector('#cpProcesses').classList.toggle('active', tab === 'processes');
    if (tab === 'processes' && !overlay.querySelector('#cpProcesses').dataset.built) renderProcesses();
    moveInk();
    if (tab === 'overview') setTimeout(animateOverview, 30);
    if (tab === 'processes') setTimeout(function () { drawSwimlane(activeProc); }, 30);
  }
  function moveInk() {
    var active = overlay.querySelector('.cp-tab.active'), ink = overlay.querySelector('#cpInk');
    if (active && ink) { ink.style.left = active.offsetLeft + 'px'; ink.style.width = active.offsetWidth + 'px'; }
  }

  /* ---------- Overview ---------- */
  function renderOverview(node) {
    var d = data(node);
    var kpis = [
      { ic: '👥', bg: 'rgba(79,110,247,.14)', name: 'Total Employees', val: d.employees, sub: '<span class="cp-trend up">▲ ' + d.empUp + '%</span> vs last quarter' },
      { ic: '💳', bg: 'rgba(34,197,94,.14)', name: 'Payroll Processed', val: d.payroll, sub: '<span class="cp-trend up">▲ ' + d.payUp + '%</span> on schedule' },
      { ic: '🗓️', bg: 'rgba(234,179,8,.16)', name: 'Attendance', val: d.attendance + '%', sub: '<span class="cp-trend down">▼ ' + d.attnDown + '%</span> vs last month' },
      { ic: '📥', bg: 'rgba(167,139,250,.16)', name: 'Job Applicants', val: d.applicants + 'K', sub: '<span class="cp-trend up">▲ ' + d.appUp + '%</span> this cycle' }
    ];
    var kpiHtml = kpis.map(function (k, i) {
      return '<div class="cp-kpi" style="--i:' + i + '"><div class="cp-kpi-top"><div class="cp-kpi-ic" style="background:' + k.bg + '">' + k.ic + '</div><div class="cp-kpi-name">' + k.name + '</div></div>' +
        '<div class="cp-kpi-val" data-count="' + parseFloat(k.val) + '" data-suffix="' + String(k.val).replace(/[0-9.]/g, '') + '">0</div><div class="cp-kpi-sub">' + k.sub + '</div></div>';
    }).join('');

    var empTotal = d.employment.reduce(function (a, e) { return a + e.value; }, 0);
    var perfRows = d.topPerf.map(function (p, i) {
      return '<div class="cp-emp-row"><div class="cp-emp-av" style="background:hsl(' + ((i * 90 + 200) % 360) + ',60%,55%)">' + initials(p.n) + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--text-primary)">' + esc(p.n) + '</div>' +
        '<div class="cp-emp-bar"><i data-w="' + p.v + '" style="background:hsl(' + ((i * 90 + 200) % 360) + ',70%,55%)"></i></div></div>' +
        '<span style="font-size:12px;font-weight:700;color:var(--text-primary)">' + p.v + '%</span></div>';
    }).join('');

    overlay.querySelector('#cpOverview').innerHTML =
      '<div class="cp-kpis">' + kpiHtml + '</div>' +
      '<div class="cp-grid">' +
        '<div class="cp-card cc-4" style="--i:0">' +
          '<div class="cp-card-h"><span class="cp-card-t">Current Project</span><span class="cp-card-s" style="color:var(--warning-dark);background:var(--warning-light);padding:3px 9px;border-radius:99px;font-weight:700">In Progress</span></div>' +
          '<div class="cp-proj-name">' + esc(d.project.name) + '</div>' +
          '<div class="cp-proj-row"><div><div class="cp-proj-k">Manager</div><div class="cp-proj-v">' + esc(d.project.pm) + '</div></div><div><div class="cp-proj-k">Design Lead</div><div class="cp-proj-v">' + esc(d.project.lead) + '</div></div></div>' +
          '<div class="cp-proj-k">Progress · Due ' + d.project.due + '</div><div class="cp-progress"><i data-w="' + d.project.progress + '"></i></div>' +
        '</div>' +
        '<div class="cp-card cc-8" style="--i:1"><div class="cp-card-h"><span class="cp-card-t">Member Work Hours</span><span class="cp-card-s">Monthly · hrs</span></div><div id="cpWork"></div>' +
          '<div class="cp-legend"><span class="cp-leg"><i style="background:#4F6EF7"></i>Work time</span><span class="cp-leg"><i style="background:#22C55E"></i>Overtime</span></div></div>' +
        '<div class="cp-card cc-4" style="--i:2"><div class="cp-card-h"><span class="cp-card-t">Employee Performance</span></div>' +
          '<div style="display:flex;align-items:baseline;gap:10px"><span class="cp-rating-big" data-count="' + d.rating + '" data-suffix="%">0%</span><span class="cp-card-s">avg. quality &amp; punctuality</span></div>' + perfRows + '</div>' +
        '<div class="cp-card cc-4" style="--i:3"><div class="cp-card-h"><span class="cp-card-t">Employment Status</span></div><div id="cpEmp"></div></div>' +
        '<div class="cp-card cc-4" style="--i:4"><div class="cp-card-h"><span class="cp-card-t">Leave Summary</span></div>' +
          '<div class="cp-leave"><div class="cp-leave-box"><div class="cp-leave-n">' + d.annualLeave + ' Days</div><div class="cp-leave-l">Annual leave</div><div class="cp-leave-btn">Request →</div></div>' +
          '<div class="cp-leave-box"><div class="cp-leave-n">' + d.sickLeave + ' Days</div><div class="cp-leave-l">Sick leave pool</div><div class="cp-leave-btn">Request →</div></div></div>' +
          '<div class="cp-card-s" style="margin-top:12px">Employees on approved leave today: <b style="color:var(--text-primary)">' + (empTotal ? Math.round(empTotal * 0.04) : 0) + '</b></div></div>' +
        '<div class="cp-card cc-12" style="--i:5"><div class="cp-card-h"><span class="cp-card-t">Notes &amp; Upcoming</span></div>' +
          d.notes.map(function (n) { return '<div class="cp-note"><span class="cp-note-dot" style="background:' + n.c + '"></span><div><div class="cp-note-t">' + esc(n.t) + '</div><div class="cp-note-d">' + esc(n.d) + '</div></div></div>'; }).join('') + '</div>' +
      '</div>';

    // charts (LCCharts is loaded on the page)
    if (window.LCCharts) {
      overlay.querySelector('#cpWork').innerHTML = LCCharts.line(d.work, {});
      // overlay a second (overtime) line by drawing donut for employment instead
      overlay.querySelector('#cpEmp').innerHTML = LCCharts.donut(d.employment, { centerLabel: 'staff', colorFn: function (l) { return { Permanent: '#4F6EF7', Contract: '#22D3EE', Probation: '#F59E0B' }[l] || '#4F6EF7'; } });
    }
    overlay.querySelector('#cpOverview').dataset.ready = '1';
  }

  function animateOverview() {
    var pane = overlay.querySelector('#cpOverview');
    pane.querySelectorAll('[data-w]').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
    pane.querySelectorAll('[data-count]').forEach(function (el) {
      countUp(el, parseFloat(el.getAttribute('data-count')), el.getAttribute('data-suffix') || '');
    });
  }
  function countUp(el, target, suffix) {
    if (reduce) { el.textContent = target + suffix; return; }
    var t0 = performance.now(), dur = 750, done = false;
    function fin() { if (!done) { done = true; el.textContent = target + suffix; } }
    (function s(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (k < 1) requestAnimationFrame(s); else fin();
    })(t0);
    // Safety: guarantee the final value even if rAF is throttled (bg tab).
    setTimeout(fin, dur + 200);
  }

  /* ---------- Processes / Swimlanes ---------- */
  var PROCESSES = {
    onboarding: {
      name: 'Employee Onboarding',
      lanes: [['HR', '#4F6EF7'], ['IT', '#22D3EE'], ['Hiring Manager', '#A78BFA'], ['New Hire', '#22C55E']],
      steps: [
        { id: 'a', lane: 'HR', col: 0, type: 'start', title: 'Offer Accepted', next: ['b'] },
        { id: 'b', lane: 'HR', col: 1, type: 'task', title: 'Create Employee Record', next: ['c'] },
        { id: 'c', lane: 'IT', col: 2, type: 'task', title: 'Provision Accounts & Devices', next: ['d'] },
        { id: 'd', lane: 'Hiring Manager', col: 3, type: 'task', title: 'Assign Buddy & 30-60-90 Plan', next: ['e'] },
        { id: 'e', lane: 'New Hire', col: 4, type: 'task', title: 'Day 1 Orientation', next: ['f'] },
        { id: 'f', lane: 'HR', col: 5, type: 'decision', title: 'Paperwork Complete?', next: ['g', 'b'], nlabels: ['Yes', 'No — rework'] },
        { id: 'g', lane: 'HR', col: 6, type: 'end', title: 'Onboarding Complete', next: [] }
      ]
    },
    procurement: {
      name: 'Procurement to Pay',
      lanes: [['Requester', '#4F6EF7'], ['Procurement', '#A78BFA'], ['Finance', '#22C55E'], ['Vendor', '#F59E0B']],
      steps: [
        { id: 'a', lane: 'Requester', col: 0, type: 'start', title: 'Raise Purchase Request', next: ['b'] },
        { id: 'b', lane: 'Procurement', col: 1, type: 'task', title: 'Review & Source Vendors', next: ['c'] },
        { id: 'c', lane: 'Finance', col: 2, type: 'decision', title: 'Budget Approved?', next: ['d', 'x'], nlabels: ['Approved', 'Rejected'] },
        { id: 'd', lane: 'Procurement', col: 3, type: 'task', title: 'Issue Purchase Order', next: ['e'] },
        { id: 'e', lane: 'Vendor', col: 4, type: 'task', title: 'Fulfil & Deliver', next: ['f'] },
        { id: 'f', lane: 'Finance', col: 5, type: 'task', title: 'Three-way Match & Pay', next: ['g'] },
        { id: 'g', lane: 'Requester', col: 6, type: 'end', title: 'Goods Received', next: [] },
        { id: 'x', lane: 'Finance', col: 3, type: 'end', title: 'Request Rejected', next: [] }
      ]
    },
    support: {
      name: 'Customer Support',
      lanes: [['Customer', '#4F6EF7'], ['Support L1', '#22D3EE'], ['Engineering', '#A78BFA'], ['QA', '#22C55E']],
      steps: [
        { id: 'a', lane: 'Customer', col: 0, type: 'start', title: 'Report Issue', next: ['b'] },
        { id: 'b', lane: 'Support L1', col: 1, type: 'task', title: 'Triage & Log Ticket', next: ['c'] },
        { id: 'c', lane: 'Support L1', col: 2, type: 'decision', title: 'Resolved at L1?', next: ['h', 'd'], nlabels: ['Yes', 'Escalate'] },
        { id: 'd', lane: 'Engineering', col: 3, type: 'task', title: 'Investigate & Fix', next: ['e'] },
        { id: 'e', lane: 'QA', col: 4, type: 'task', title: 'Verify Fix', next: ['f'] },
        { id: 'f', lane: 'Engineering', col: 5, type: 'task', title: 'Deploy Resolution', next: ['h'] },
        { id: 'h', lane: 'Support L1', col: 6, type: 'end', title: 'Close Ticket', next: [] }
      ]
    }
  };
  var STCOL = { start: '#22C55E', task: '#4F6EF7', decision: '#EAB308', end: '#EF4444' };

  // People assigned to each step, drawn from the lane's department. Deterministic
  // per (company, step) so the roster is stable every time.
  var FIRST = ['Nicole', 'Fernando', 'Amara', 'Ravi', 'Sofia', 'Omar', 'Mei', 'Leah', 'Yusuf', 'Priya', 'Marcus', 'Hana', 'David', 'Aisha', 'Noor', 'James', 'Carlos', 'Zara', 'Elena', 'Kofi'];
  var LAST = ['Foster', 'Agaro', 'Okafor', 'Sharma', 'Rossi', 'Khalid', 'Chen', 'Bell', 'Silva', 'Patel', 'Thompson', 'Wilson', 'Mendez', 'Costa', 'Mensah', 'Lee', 'Warren', 'Fox', 'Jones', 'Cooper'];
  var LANE_TITLES = {
    'HR': ['HR Officer', 'HR Business Partner', 'People Ops Specialist'],
    'IT': ['IT Support Analyst', 'Systems Engineer', 'IT Administrator'],
    'Hiring Manager': ['Department Manager', 'Team Lead'],
    'New Hire': ['New Employee'],
    'Requester': ['Requesting Officer', 'Budget Owner'],
    'Procurement': ['Procurement Officer', 'Sourcing Specialist'],
    'Finance': ['Finance Officer', 'Financial Analyst', 'Accounts Payable Clerk'],
    'Vendor': ['Vendor Account Manager', 'Supplier Representative'],
    'Customer': ['Customer Contact'],
    'Support L1': ['Support Agent', 'Service Desk Analyst'],
    'Engineering': ['Software Engineer', 'DevOps Engineer'],
    'QA': ['QA Engineer', 'Test Analyst']
  };
  function personPhoto(seed) { var s = String(seed), x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; var g = (x % 2) ? 'women' : 'men'; if (window.lcPhoto) return window.lcPhoto(s, g, 160); return 'https://randomuser.me/api/portraits/' + g + '/' + (x % 100) + '.jpg'; }
  function assignees(company, step) {
    var base = h(sh((company && company.id || 'x') + ':' + step.id));
    var titles = LANE_TITLES[step.lane] || ['Team Member'];
    var singles = { 'New Hire': 1, 'Customer': 1 };
    var n = singles[step.lane] || (1 + ((base >>> 2) % 3));
    var used = {}, out = [];
    for (var i = 0; i < n; i++) {
      var v = h(base + (i + 1) * 0x9E3779B1);
      var fn = FIRST[v % FIRST.length], ln = LAST[(v >>> 5) % LAST.length];
      if (used[fn + ln]) ln = LAST[(v >>> 9) % LAST.length];
      used[fn + ln] = 1;
      var email = (fn + '.' + ln).toLowerCase() + '@lyceum.edu';
      var phone = '+968 24' + (10 + (v % 80)) + ' ' + (1000 + ((v >>> 3) % 9000));
      out.push({ name: fn + ' ' + ln, title: titles[(v >>> 8) % titles.length], dept: step.lane, email: email, phone: phone, initials: (fn[0] + ln[0]).toUpperCase(), hue: v % 360, seed: email });
    }
    return out;
  }
  function assigneeChip(people) {
    if (!people.length) return '';
    var av = people.slice(0, 2).map(function (p) { return '<span class="ba-av" style="background:hsl(' + p.hue + ',58%,55%)">' + esc(p.initials) + '<img src="' + personPhoto(p.seed) + '" onerror="this.remove()"></span>'; }).join('');
    var more = people.length > 2 ? '<span class="ba-more">+' + (people.length - 2) + '</span>' : '';
    return '<div class="bpmn-assignees">' + av + more + '</div>';
  }
  var currentSteps = {}, currentPeople = {}, currentPop = null;
  var STICON = {
    start: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    task: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
    decision: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3l9 9-9 9-9-9z"/></svg>',
    end: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>'
  };

  function renderProcesses() {
    var pane = overlay.querySelector('#cpProcesses');
    var pills = Object.keys(PROCESSES).map(function (k, i) {
      return '<button class="cp-proc-pill' + (k === activeProc ? ' active' : '') + '" data-proc="' + k + '"><span style="width:8px;height:8px;border-radius:50%;background:currentColor"></span>' + esc(PROCESSES[k].name) + '</button>';
    }).join('');
    var legendItems = [['Start event', '#22C55E'], ['Task', '#4F6EF7'], ['Gateway', '#EAB308'], ['End event', '#EF4444']];
    var legend = legendItems.map(function (it) { return '<span class="cp-pl"><i style="background:' + it[1] + '"></i>' + it[0] + '</span>'; }).join('');
    pane.innerHTML =
      '<div class="cp-proc-bar">' + pills + '<div class="cp-proc-legend">' + legend + '</div></div>' +
      '<div class="cp-swim-frame"><div class="cp-swim" id="cpSwim"></div></div>' +
      '<p class="cp-card-s" style="margin-top:12px">Cross-functional (swimlane) view in <b>BPMN 2.0</b> notation (ISO/IEC 19510): circles are events (thin = start, thick = end), rounded rectangles are tasks, and diamonds are exclusive gateways (decisions). Rows are departments (lanes); arrows are sequence flows.</p>';
    pane.querySelector('.cp-proc-bar').addEventListener('click', function (e) {
      var p = e.target.closest('.cp-proc-pill'); if (!p) return;
      closePop();
      activeProc = p.getAttribute('data-proc');
      Array.prototype.forEach.call(pane.querySelectorAll('.cp-proc-pill'), function (b) { b.classList.toggle('active', b === p); });
      drawSwimlane(activeProc);
    });
    // Click a node → show the department people assigned to that step.
    var swim = pane.querySelector('#cpSwim');
    swim.addEventListener('click', function (e) {
      var nodeEl = e.target.closest('.bpmn-node'); if (!nodeEl) return;
      var step = currentSteps[nodeEl.getAttribute('data-step')];
      if (step) openAssignees(nodeEl, step);
    });
    pane.querySelector('.cp-swim-frame').addEventListener('scroll', closePop);
    pane.dataset.built = '1';
  }

  /* ---------- assignee popover ---------- */
  function openAssignees(nodeEl, step) {
    closePop();
    var people = currentPeople[step.id] || [];
    var kind = { start: 'Start event', end: 'End event', decision: 'Gateway', task: 'Task' }[step.type] || 'Step';
    var pop = document.createElement('div');
    pop.className = 'bpmn-pop';
    pop.innerHTML =
      '<div class="bpp-head"><div><div class="bpp-title">' + esc(step.title) + '</div><div class="bpp-sub">' + esc(step.lane) + ' · ' + kind + ' · ' + people.length + ' assigned</div></div>' +
        '<button class="bpp-x" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
      '<div class="bpp-list">' + people.map(function (p) {
        return '<div class="bpp-person"><span class="bpp-av" style="background:hsl(' + p.hue + ',58%,52%)">' + esc(p.initials) + '<img src="' + personPhoto(p.seed) + '" onerror="this.remove()"></span>' +
          '<div class="bpp-info"><div class="bpp-name">' + esc(p.name) + '</div><div class="bpp-role">' + esc(p.title) + '</div>' +
            '<div class="bpp-contact"><span class="bpp-c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>' + esc(p.email) + '</span>' +
            '<span class="bpp-c"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' + esc(p.phone) + '</span></div>' +
          '</div>' +
          '<div class="bpp-actions"><a class="bpp-msg" href="tel:' + esc(p.phone.replace(/\s/g, '')) + '" title="Call ' + esc(p.name) + '" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg></a>' +
            '<a class="bpp-msg" href="mailto:' + esc(p.email) + '" title="Email ' + esc(p.name) + '" onclick="event.stopPropagation()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></a></div></div>';
      }).join('') + '</div>';
    document.body.appendChild(pop);

    // Anchor beside the node, flipping / clamping to stay on-screen.
    var r = nodeEl.getBoundingClientRect(), pw = pop.offsetWidth || 292, ph = pop.offsetHeight;
    var left = r.right + 12;
    if (left + pw > window.innerWidth - 12) left = r.left - pw - 12;
    if (left < 12) left = Math.max(12, (window.innerWidth - pw) / 2);
    var top = Math.max(12, Math.min(r.top + r.height / 2 - ph / 2, window.innerHeight - ph - 12));
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    void pop.offsetWidth; // reflow, then open — reliable even when rAF is throttled
    setTimeout(function () { pop.classList.add('open'); }, 10);
    pop.querySelector('.bpp-x').addEventListener('click', closePop);
    currentPop = pop;
    setTimeout(function () { document.addEventListener('mousedown', outsidePop); }, 0);
  }
  function outsidePop(e) {
    if (currentPop && !currentPop.contains(e.target) && !e.target.closest('.bpmn-node')) closePop();
  }
  function closePop() {
    if (!currentPop) return;
    document.removeEventListener('mousedown', outsidePop);
    var el = currentPop; currentPop = null;
    el.classList.remove('open');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 180);
  }

  // Rounded orthogonal path builder for BPMN sequence flows.
  function _u(from, to) { var dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
  function _d(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function _r(n) { return Math.round(n * 10) / 10; }
  function roundedPath(pts, r) {
    // Drop consecutive duplicate points so collinear/degenerate corners vanish.
    var p = [pts[0]];
    for (var k = 1; k < pts.length; k++) { if (_d(pts[k], p[p.length - 1]) > 0.5) p.push(pts[k]); }
    if (p.length < 2) return '';
    if (p.length === 2) return 'M' + _r(p[0][0]) + ' ' + _r(p[0][1]) + ' L' + _r(p[1][0]) + ' ' + _r(p[1][1]);
    var d = 'M' + _r(p[0][0]) + ' ' + _r(p[0][1]);
    for (var i = 1; i < p.length - 1; i++) {
      var a = p[i - 1], c = p[i], b = p[i + 1];
      var r1 = Math.min(r, _d(a, c) / 2), r2 = Math.min(r, _d(b, c) / 2);
      var u1 = _u(c, a), u2 = _u(c, b);
      var p1 = [c[0] + u1[0] * r1, c[1] + u1[1] * r1], p2 = [c[0] + u2[0] * r2, c[1] + u2[1] * r2];
      d += ' L' + _r(p1[0]) + ' ' + _r(p1[1]) + ' Q' + _r(c[0]) + ' ' + _r(c[1]) + ' ' + _r(p2[0]) + ' ' + _r(p2[1]);
    }
    var last = p[p.length - 1];
    d += ' L' + _r(last[0]) + ' ' + _r(last[1]);
    return d;
  }

  function drawSwimlane(key) {
    var proc = PROCESSES[key]; if (!proc) return;
    var swim = overlay.querySelector('#cpSwim'); if (!swim) return;
    var labelW = 132, colW = 200, laneH = 124, maxCol = 0;
    proc.steps.forEach(function (s) { maxCol = Math.max(maxCol, s.col); });
    var laneIndex = {}; proc.lanes.forEach(function (l, i) { laneIndex[l[0]] = i; });
    var W = labelW + (maxCol + 1) * colW, H = proc.lanes.length * laneH;
    swim.style.width = W + 'px'; swim.style.height = H + 'px';

    var lanesHtml = proc.lanes.map(function (l, i) {
      return '<div class="cp-lane" style="top:' + (i * laneH) + 'px;height:' + laneH + 'px">' +
        '<div class="cp-lane-label" style="width:' + labelW + 'px;background:' + l[1] + '">' + esc(l[0]) + '</div></div>';
    }).join('');

    function pos(s) { return { x: labelW + s.col * colW + colW / 2, y: laneIndex[s.lane] * laneH + laneH / 2 }; }
    var byId = {}; proc.steps.forEach(function (s) { byId[s.id] = s; });

    // Assign department people to each step (for the click-through details).
    currentSteps = byId; currentPeople = {};
    proc.steps.forEach(function (s) { currentPeople[s.id] = assignees(current, s); });

    // BPMN node footprints (for connector anchoring): events = 46px circle,
    // gateway = 56px diamond bbox, task = 168×52 rounded rectangle.
    function nodeSize(type) { return type === 'task' ? { w: 168, h: 52 } : type === 'decision' ? { w: 56, h: 56 } : { w: 46, h: 46 }; }

    // Sequence flows — orthogonal (right-angle) routing per BPMN convention:
    // forward flows exit the source's right edge and enter the target's left
    // edge (stepping through the inter-column gap when lanes differ); loops run
    // up through a channel above the lane and drop into the target's top.
    var links = '', flowLabels = '', li = 0;
    proc.steps.forEach(function (s) {
      var ps = pos(s), ss = nodeSize(s.type);
      (s.next || []).forEach(function (nid, ni) {
        var t = byId[nid]; if (!t) return; var qs = pos(t), ts = nodeSize(t.type);
        var pts, mid;
        if (t.col > s.col) { // forward
          var x1 = ps.x + ss.w / 2, y1 = ps.y, x2 = qs.x - ts.w / 2, y2 = qs.y;
          if (Math.abs(y1 - y2) < 1) { pts = [[x1, y1], [x2, y2]]; }
          else { var gx = (x1 + x2) / 2; pts = [[x1, y1], [gx, y1], [gx, y2], [x2, y2]]; }
          mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        } else { // loop / backward — channel above the source lane
          var bx1 = ps.x, by1 = ps.y - ss.h / 2, bx2 = qs.x, by2 = qs.y - ts.h / 2;
          var chan = laneIndex[s.lane] * laneH + 18;
          pts = [[bx1, by1], [bx1, chan], [bx2, chan], [bx2, by2]];
          mid = { x: (bx1 + bx2) / 2, y: chan };
        }
        links += '<path d="' + roundedPath(pts, 10) + '" marker-end="url(#cpArrow)" style="--d:' + (0.25 + li * 0.08) + 's"></path>';
        var lbl = s.nlabels && s.nlabels[ni];
        if (lbl) flowLabels += '<div class="bpmn-flowlabel" style="left:' + mid.x + 'px;top:' + mid.y + 'px">' + esc(lbl) + '</div>';
        li++;
      });
    });

    var X_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
    var stepsHtml = proc.steps.map(function (s) {
      var p = pos(s), inner, chip = assigneeChip(currentPeople[s.id] || []);
      if (s.type === 'task') {
        inner = '<div class="bpmn-task"><span class="bpmn-tt">' + esc(s.title) + '</span></div>' + chip;
      } else if (s.type === 'decision') {
        inner = '<div class="bpmn-gateway"><span class="gw-shape"></span><span class="gw-x">' + X_SVG + '</span></div>' + chip + '<div class="bpmn-label">' + esc(s.title) + '</div>';
      } else { // start / end events — plain circles (BPMN "none" events)
        inner = '<div class="bpmn-event"></div>' + chip + '<div class="bpmn-label">' + esc(s.title) + '</div>';
      }
      return '<div class="bpmn-node type-' + s.type + '" data-step="' + s.id + '" title="' + esc(s.title) + ' — click to view assignees" style="left:' + p.x + 'px;top:' + p.y + 'px;--d:' + (0.05 + s.col * 0.09) + 's">' + inner + '</div>';
    }).join('');

    swim.innerHTML = lanesHtml +
      '<svg class="cp-swim-links" width="' + W + '" height="' + H + '"><defs><marker id="cpArrow" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="8.5" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 1 L9 5 L0 9 Z" fill="var(--border-strong)"/></marker></defs>' + links + '</svg>' +
      stepsHtml + flowLabels;

    // set dash length for draw animation
    if (!reduce) {
      swim.querySelectorAll('.cp-swim-links path').forEach(function (path) {
        var len = path.getTotalLength(); path.style.setProperty('--len', len);
      });
    }
  }

  /* ---------- expose ---------- */
  window.openCompanyPerformance = open;
})();
