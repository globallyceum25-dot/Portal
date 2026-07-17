/* ============================================================
   LYCEUM CONNECT — Personalised widget dashboard engine
   Renders a customisable bento of widgets (add / remove /
   drag-reorder, persisted to localStorage). Uses LCCharts for
   the visualisations. Zero dependencies, theme-aware, offline.
   ============================================================ */
(function () {
  'use strict';
  var C = window.LCCharts || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  /* ---------------- Data (deterministic demo data) ---------------- */
  var DATA = {
    user: { name: 'LGH IT Test', first: 'LGH IT Test', role: 'IT Governance Lead', dept: 'Information Technology', avatar: 'LT', photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=640&h=760&q=80&crop=faces', company: 'Lyceum Global Holdings', companyLogo: 'assets/logo.png' },
    devices: [
      { name: 'MacBook Pro 16" (M3)', meta: 'Asset LGH-IT-2043 · macOS 15', ico: 'laptop', status: 'Active', c: '#22C55E' },
      { name: 'iPhone 14 Pro', meta: 'Asset LGH-MB-1187 · iOS 18', ico: 'phone', status: 'Active', c: '#22C55E' },
      { name: 'Dell UltraSharp 27"', meta: 'Asset LGH-MN-0562', ico: 'monitor', status: 'Active', c: '#22C55E' },
      { name: 'YubiKey 5C NFC', meta: 'Asset LGH-SK-0091', ico: 'key', status: 'Renew soon', c: '#EAB308' }
    ],
    inquiries: [
      { t: 'VPN access for contractor', m: 'IT Helpdesk · #INQ-4582', st: 'In review', c: 'st-review' },
      { t: 'Payroll tax certificate', m: 'Finance · #INQ-4573', st: 'Resolved', c: 'st-done' },
      { t: 'Parking permit renewal', m: 'Facilities · #INQ-4569', st: 'Open', c: 'st-open' },
      { t: 'Training budget approval', m: 'HR · #INQ-4561', st: 'Resolved', c: 'st-done' },
      { t: 'Meeting room A/V fault', m: 'Facilities · #INQ-4558', st: 'Closed', c: 'st-closed' }
    ],
    inquiryStatus: [ { label: 'Open', value: 3 }, { label: 'In review', value: 2 }, { label: 'Resolved', value: 8 }, { label: 'Closed', value: 4 } ],
    attendance: { rate: 97, present: 21, wfh: 6, leave: 2, late: 1, monthly: [ { d: 'Apr', h: 96 }, { d: 'May', h: 98 }, { d: 'Jun', h: 95 }, { d: 'Jul', h: 99 }, { d: 'Aug', h: 97 }, { d: 'Sep', h: 97, hi: true } ] },
    leaveElig: [
      { label: 'Annual leave', value: 14, max: 21, note: '14 of 21 left', color: '#4F6EF7' },
      { label: 'Casual leave', value: 4, max: 7, note: '4 of 7 left', color: '#22C55E' },
      { label: 'Sick leave', value: 12, max: 14, note: '12 of 14 left', color: '#EAB308' },
      { label: 'No-pay eligible', value: 30, max: 30, note: '30 days', color: '#94A3B8' }
    ],
    announcements: [
      { t: 'New HR Policy on Remote Work', s: 'Effective July 1st', time: '2h ago', c: '#4F6EF7', bg: 'var(--primary-50)', ic: 'mega' },
      { t: 'Q2 Top Performers announced', s: 'Congratulations to the winners!', time: '5h ago', c: '#EAB308', bg: '#FEF9C3', ic: 'award' },
      { t: 'Town Hall Meeting — Friday 2PM', s: 'Main auditorium & livestream', time: '1d ago', c: '#22C55E', bg: '#DCFCE7', ic: 'cal' },
      { t: 'Payroll processed for September', s: 'Slips available in ESS', time: '2d ago', c: '#38BDF8', bg: '#E0F2FE', ic: 'cash' }
    ],
    apps: [
      { n: 'Microsoft 365', k: 'M', c: '#D83B01' }, { n: 'Slack', k: 'S', c: '#611f69' },
      { n: 'Zoom', k: 'Z', c: '#2D8CFF' }, { n: 'Jira', k: 'J', c: '#0052CC' },
      { n: 'GitHub', k: 'G', c: '#111827' }, { n: 'Salesforce', k: 'sf', c: '#00A1E0' },
      { n: 'Workday', k: 'W', c: '#F38B00' }, { n: 'Notion', k: 'N', c: '#111827' }
    ],
    rooms: [
      { name: 'Boardroom A', cap: 12, status: 'Available' },
      { name: 'Meeting Room 2', cap: 6, status: 'Busy', till: '2:30 PM' },
      { name: 'Huddle Room 3', cap: 4, status: 'Available' },
      { name: 'Training Hall', cap: 40, status: 'Busy', till: '4:00 PM' }
    ],
    vehicles: [
      { name: 'Toyota Hiace Van', type: '8-seater van', status: 'Available' },
      { name: 'Executive — Camry', type: 'Sedan', status: 'Available' },
      { name: 'Shuttle Bus', type: '28-seater', status: 'Busy', till: '12:00 PM' },
      { name: 'Sedan — Corolla', type: 'Sedan', status: 'Available' }
    ],
    employees: [
      { i: 'RP', n: 'Raj Patel', r: 'IT Manager', bg: 'linear-gradient(135deg,#059669,#10B981)' },
      { i: 'FA', n: 'Fatima Al-Hassan', r: 'Finance Director', bg: 'linear-gradient(135deg,#7C3AED,#A855F7)' },
      { i: 'MC', n: 'Michael Chen', r: 'Principal', bg: 'linear-gradient(135deg,#D97706,#F59E0B)' },
      { i: 'PS', n: 'Priya Sharma', r: 'Marketing Manager', bg: 'linear-gradient(135deg,#0D9488,#14B8A6)' },
      { i: 'AA', n: 'Ahmed Al-Rashid', r: 'Operations Director', bg: 'linear-gradient(135deg,#E11D48,#F43F5E)' },
      { i: 'LT', n: 'Lisa Thompson', r: 'HR Officer', bg: 'linear-gradient(135deg,#4F6EF7,#6D86FF)' }
    ]
  };

  /* ---------------- small icon set ---------------- */
  function ic(name) {
    var p = {
      target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
      star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      laptop: '<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="1" y1="21" x2="23" y2="21"/>',
      phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/>',
      monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
      key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.6 12.4 21 2l1 1-2 2 1 1-2 2-1-1-3.4 3.4"/>',
      help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
      bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      mega: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
      search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      ticket: '<path d="M3 7v4a1 1 0 0 0 0 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a1 1 0 0 0 0-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
      pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
      award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
      cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/>',
      rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
      id: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M13 8h5M13 12h5M7 15.5c.7-1.2 3.3-1.2 4 0"/>',
      car: '<path d="M5 13l1.4-4.2A2 2 0 0 1 8.3 7.5h7.4a2 2 0 0 1 1.9 1.3L19 13"/><path d="M4 13h16v4H4z"/><circle cx="7.5" cy="17" r="1.4"/><circle cx="16.5" cy="17" r="1.4"/>',
      gate: '<path d="M4 21V10l8-5 8 5v11"/><path d="M9 21v-6h6v6"/><path d="M3 21h18"/>',
      park: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9.5 17V7h3.2a3 3 0 0 1 0 6H9.5"/>',
      doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
      wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3 18l3 3 6.4-6.4a4 4 0 0 0 5.3-5.3l-2.9 2.9-2.1-2.1z"/>',
      truck: '<rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 9h4l3 3v4h-7z"/><circle cx="6" cy="18.5" r="1.5"/><circle cx="18" cy="18.5" r="1.5"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (p[name] || p.grid) + '</svg>';
  }
  function tint(cardColor) { return cardColor; }

  /* ---------------- Widget renderers ---------------- */
  function num(v, o) { o = o || {}; return '<span class="num" data-to="' + v + '" data-dec="' + (o.dec || 0) + '" data-suf="' + (o.suf || '') + '" data-pre="' + (o.pre || '') + '">' + (o.pre || '') + '0' + (o.suf || '') + '</span>'; }

  function rWelcome() {
    var u = DATA.user, d = new Date();
    var day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    return '<div class="hero-inner">' +
      '<div class="hero-orb a"></div><div class="hero-orb b"></div>' +
      '<div class="hero-left">' +
        (u.company ? '<div class="hero-company">' +
          '<span class="hc-logo">' + (u.companyLogo ? '<img src="' + u.companyLogo + '" alt="" onerror="this.remove()">' : '') + '</span>' +
          '<span><span class="hc-name">' + esc(u.company) + '</span><span class="hc-sub">' + esc(u.dept) + '</span></span>' +
        '</div>' : '') +
        '<div class="hero-hi">' + esc(day) + '</div>' +
        '<div class="hero-name">Welcome back, ' + esc(u.first) + '</div>' +
        '<div class="hero-sub">You have <b style="color:#fff">3 tasks due</b> today and <b style="color:#fff">2 inquiries</b> awaiting response. Your SLA health is excellent this month.</div>' +
        '<div class="hero-pills">' +
          '<div class="hero-pill"><span class="dot" style="background:#4F6EF7"></span><div><b>' + num(3) + '</b><small>Due today</small></div></div>' +
          '<div class="hero-pill"><span class="dot" style="background:#22C55E"></span><div><b>' + num(97, { suf: '%' }) + '</b><small>Attendance</small></div></div>' +
          '<div class="hero-pill"><span class="dot" style="background:#EAB308"></span><div><b>' + num(4.6, { dec: 1 }) + '</b><small>Appraisal</small></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="hero-photo">' +
        '<span class="hero-photo-fallback">' + esc(u.avatar) + '</span>' +
        (u.photo ? '<img class="hero-photo-img" src="' + u.photo + '" alt="' + esc(u.first) + '" onerror="this.remove()">' : '') +
        '<span class="hero-photo-badge"><span class="hp-dot"></span> Online</span>' +
        '<div class="hero-photo-cap"><div class="hp-name">' + esc(u.first) + '</div><div class="hp-role">' + esc(u.role) + '</div></div>' +
      '</div>' +
    '</div>';
  }


  function rDevices() {
    return DATA.devices.map(function (d) {
      var badgeBg = d.c === '#22C55E' ? '#DCFCE7' : '#FEF3C7', badgeFg = d.c === '#22C55E' ? '#15803D' : '#B45309';
      return '<div class="dev"><div class="dev-ico">' + ic(d.ico) + '</div>' +
        '<div class="dev-mid"><div class="dev-name">' + esc(d.name) + '</div><div class="dev-meta">' + esc(d.meta) + '</div></div>' +
        '<span class="dev-badge" style="background:' + badgeBg + ';color:' + badgeFg + '">' + esc(d.status) + '</span></div>';
    }).join('') + '<div class="tile-foot"><a class="tile-link-all" href="profile.html">Manage assets →</a></div>';
  }

  function rInquiries() {
    var stColor = { 'st-open': ['#E0E7FF', '#4338CA'], 'st-review': ['#E0F2FE', '#0369A1'], 'st-done': ['#DCFCE7', '#15803D'], 'st-closed': ['#E2E8F0', '#475569'] };
    var list = DATA.inquiries.map(function (q) {
      var c = stColor[q.c];
      return '<div class="inq"><div class="inq-mid"><div class="inq-t">' + esc(q.t) + '</div><div class="inq-m">' + esc(q.m) + '</div></div>' +
        '<span class="st" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(q.st) + '</span></div>';
    }).join('');
    var donut = C.donut(DATA.inquiryStatus, {
      centerLabel: 'inquiries',
      colorFn: function (l) { return ({ 'Open': '#4F6EF7', 'In review': '#38BDF8', 'Resolved': '#22C55E', 'Closed': '#94A3B8' })[l] || '#4F6EF7'; }
    });
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px;align-items:center">' +
      '<div>' + donut + '</div><div>' + list + '</div></div>' +
      '<div class="tile-foot"><a class="tile-link-all" href="request-tracking.html">View all inquiries →</a></div>';
  }

  function rLeaveAtt() {
    var a = DATA.attendance;
    var data = a.monthly.map(function (m) { return { label: m.d, value: m.h, highlight: m.hi }; });
    return '<div class="gauge-row" style="margin-bottom:12px">' +
      C.gauge(a.rate, { size: 100, color: '#22C55E', sub: 'attendance' }) +
      '<div class="mini-stats">' +
        '<div class="mini-stat"><span class="lbl"><i style="background:#22C55E"></i>Present</span><b>' + a.present + ' d</b></div>' +
        '<div class="mini-stat"><span class="lbl"><i style="background:#4F6EF7"></i>WFH</span><b>' + a.wfh + ' d</b></div>' +
        '<div class="mini-stat"><span class="lbl"><i style="background:#EAB308"></i>On leave</span><b>' + a.leave + ' d</b></div>' +
        '<div class="mini-stat"><span class="lbl"><i style="background:#EF4444"></i>Late</span><b>' + a.late + '</b></div>' +
      '</div></div>' +
      '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:6px">Attendance % — last 6 months</div>' +
      '<div class="chart-slot" data-chart="leaveatt"></div>';
  }

  function rLeaveElig() {
    return C.progressRows(DATA.leaveElig) +
      '<div class="tile-foot"><a class="tile-link-all" href="request-form.html?service=leave">Apply for leave →</a></div>';
  }

  /* ---- Section 2 ---- */
  function rQuick() {
    var items = [
      { h: 'request-form.html?service=it-ticket', bg: '#E0E7FF', fg: '#4F46E5', ico: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', l: 'New Request' },
      { h: 'request-form.html?service=expense', bg: '#DCFCE7', fg: '#15803D', ico: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', l: 'Submit Expense' },
      { h: 'meeting-transcription.html', bg: '#F3E8FF', fg: '#7C3AED', ico: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', l: 'Book Meeting' },
      { h: 'employee-directory.html', bg: '#FFE4E6', fg: '#E11D48', ico: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', l: 'Find Colleague' },
      { h: 'knowledge-center.html', bg: '#CCFBF1', fg: '#0D9488', ico: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', l: 'Knowledge Base' },
      { h: 'request-form.html?service=it-ticket', bg: '#FFEDD5', fg: '#C2410C', ico: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', l: 'Report Issue' }
    ];
    return '<div class="qa">' + items.map(function (q) {
      return '<a href="' + q.h + '"><span class="qi" style="background:' + q.bg + ';color:' + q.fg + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + q.ico + '</svg></span><span class="ql">' + q.l + '</span></a>';
    }).join('') + '</div>';
  }

  function rAnnounce() {
    return DATA.announcements.map(function (a) {
      return '<a class="an" href="announcements.html"><span class="an-ic" style="background:' + a.bg + ';color:' + a.c + '">' + ic(a.ic) + '</span>' +
        '<span style="flex:1"><span class="an-tx"><b>' + esc(a.t) + '</b> — ' + esc(a.s) + '</span><div class="an-time">' + esc(a.time) + '</div></span></a>';
    }).join('') + '<div class="tile-foot"><a class="tile-link-all" href="announcements.html">All announcements →</a></div>';
  }

  function rSearch() {
    return '<div class="es-wrap"><span class="es-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">' +
      '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>' +
      '<input class="es-in" id="empSearch" placeholder="Search employees by name or role…" autocomplete="off"></div>' +
      '<div id="empResults"></div>';
  }

  function rApps() {
    return '<div class="apps">' + DATA.apps.map(function (a) {
      return '<div class="app" data-app="' + esc(a.n) + '"><div class="app-ic" style="background:' + a.c + '">' + esc(a.k) + '</div><div class="app-nm">' + esc(a.n) + '</div></div>';
    }).join('') + '</div><div class="tile-foot" style="font-size:11.5px;color:var(--text-tertiary);display:flex;align-items:center;gap:6px">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> One-click sign-in via SSO</div>';
  }

  /* extra / optional widgets */
  function rGoals() {
    var g = [ { label: 'Certification — CISSP', value: 65, max: 100, note: '65%', color: '#4F6EF7' }, { label: 'Mentoring hours', value: 8, max: 12, note: '8/12', color: '#22C55E' }, { label: 'Innovation ideas', value: 3, max: 5, note: '3/5', color: '#EAB308' } ];
    return C.progressRows(g);
  }
  function rBirthdays() {
    var b = [ { i: 'MC', n: 'Michael Chen', d: 'Today 🎂', bg: 'linear-gradient(135deg,#D97706,#F59E0B)' }, { i: 'PS', n: 'Priya Sharma', d: 'Sep 21', bg: 'linear-gradient(135deg,#0D9488,#14B8A6)' }, { i: 'AA', n: 'Ahmed Al-Rashid', d: 'Sep 24', bg: 'linear-gradient(135deg,#E11D48,#F43F5E)' } ];
    return b.map(function (p) { return '<div class="es-r"><div class="es-av" style="background:' + p.bg + '">' + p.i + '</div><div style="flex:1"><div class="es-n">' + p.n + '</div><div class="es-role">' + p.d + '</div></div></div>'; }).join('');
  }
  function rHolidays() {
    var h = [ { n: 'Milad un-Nabi', d: 'Sep 16' }, { n: 'Deepavali', d: 'Oct 20' }, { n: 'Christmas Day', d: 'Dec 25' } ];
    return h.map(function (x) { return '<div class="mini-stat" style="padding:9px 0;border-bottom:1px solid var(--border-light)"><span class="lbl">' + x.n + '</span><b>' + x.d + '</b></div>'; }).join('');
  }
  function rNotes() {
    return '<textarea id="dashNotes" placeholder="Jot a quick note…" style="width:100%;min-height:120px;resize:vertical;border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13px;font-family:inherit;background:var(--bg-tertiary);color:var(--text-primary);outline:none"></textarea>';
  }

  /* ---- Workplace services (book / apply) ---- */
  var SERVICES = [
    { id: 'room', short: 'Meeting Room', title: 'Book a Meeting Room', ic: 'cal', color: '#4F6EF7', prefix: 'MRB',
      fields: [ { k: 'room', label: 'Room', type: 'select', options: ['Boardroom A (12)', 'Meeting Room 2 (6)', 'Huddle Room 3 (4)', 'Training Hall (40)'] }, { k: 'date', label: 'Date', type: 'date' }, { k: 'time', label: 'Start time', type: 'time' }, { k: 'att', label: 'Attendees', type: 'number', placeholder: 'e.g. 6' } ] },
    { id: 'entry', short: 'Entry Pass', title: 'Apply for an Entry Pass', ic: 'id', color: '#22C55E', prefix: 'ENP',
      fields: [ { k: 'visitor', label: 'Visitor name', type: 'text', placeholder: 'Full name' }, { k: 'company', label: 'Company', type: 'text', placeholder: 'Organisation' }, { k: 'date', label: 'Visit date', type: 'date' }, { k: 'host', label: 'Host / department', type: 'text', placeholder: 'Who they are visiting' } ] },
    { id: 'vehicle', short: 'Vehicle', title: 'Book a Vehicle', ic: 'car', color: '#EAB308', prefix: 'VHB',
      fields: [ { k: 'vehicle', label: 'Vehicle', type: 'select', options: ['Toyota Hiace Van', 'Executive — Camry', 'Sedan — Corolla', 'Shuttle Bus (28)'] }, { k: 'date', label: 'Date', type: 'date' }, { k: 'time', label: 'Pickup time', type: 'time' }, { k: 'dest', label: 'Destination', type: 'text', placeholder: 'Where to?' } ] },
    { id: 'gate', short: 'Gate Pass', title: 'Apply for a Gate Pass', ic: 'gate', color: '#EF4444', prefix: 'GPS',
      fields: [ { k: 'item', label: 'Item(s)', type: 'text', placeholder: 'What is leaving the premises' }, { k: 'reason', label: 'Reason', type: 'text', placeholder: 'Purpose' }, { k: 'date', label: 'Date', type: 'date' }, { k: 'ret', label: 'Returnable?', type: 'select', options: ['Non-returnable', 'Returnable'] } ] },
    { id: 'parking', short: 'Parking', title: 'Reserve a Parking Slot', ic: 'park', color: '#38BDF8', prefix: 'PKS',
      fields: [ { k: 'zone', label: 'Zone', type: 'select', options: ['Zone A — Basement', 'Zone B — Ground', 'Zone C — Visitor'] }, { k: 'date', label: 'Date', type: 'date' }, { k: 'plate', label: 'Vehicle plate', type: 'text', placeholder: 'e.g. WP CAB-1234' } ] },
    { id: 'letter', short: 'Service Letter', title: 'Request a Service Letter', ic: 'doc', color: '#7C3AED', prefix: 'SLR',
      fields: [ { k: 'type', label: 'Letter type', type: 'select', options: ['Employment confirmation', 'Salary confirmation', 'No-objection (NOC)', 'Experience letter'] }, { k: 'copies', label: 'Copies', type: 'number', placeholder: '1' } ] },
    { id: 'maint', short: 'Maintenance', title: 'Log a Maintenance Request', ic: 'wrench', color: '#F97316', prefix: 'MNT',
      fields: [ { k: 'loc', label: 'Location', type: 'text', placeholder: 'Building / room' }, { k: 'issue', label: 'Issue', type: 'text', placeholder: 'Describe the problem' }, { k: 'pri', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] } ] },
    { id: 'courier', short: 'Courier', title: 'Request a Courier / Dispatch', ic: 'truck', color: '#0D9488', prefix: 'CUR',
      fields: [ { k: 'dest', label: 'Destination', type: 'text', placeholder: 'Delivery address' }, { k: 'date', label: 'Pickup date', type: 'date' }, { k: 'type', label: 'Type', type: 'select', options: ['Document', 'Parcel', 'Bulk'] } ] }
  ];
  function svcById(id) { for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return SERVICES[i]; return null; }

  function rServices() {
    return '<div class="svc-grid">' + SERVICES.map(function (s) {
      return '<button class="svc" data-svc="' + s.id + '" type="button"><span class="svc-ic" style="background:' + s.color + '22;color:' + s.color + '">' + ic(s.ic) + '</span><span class="svc-l">' + esc(s.short) + '</span></button>';
    }).join('') + '</div>';
  }
  function roomRows(items, kind) {
    return items.map(function (r) {
      var avail = r.status === 'Available';
      return '<div class="mr"><div class="mr-mid"><div class="mr-n">' + esc(r.name) + '</div><div class="mr-m">' +
        (kind === 'room' ? ('Seats ' + r.cap) : esc(r.type)) + ' · ' + (avail ? 'Free now' : 'Busy till ' + esc(r.till)) + '</div></div>' +
        '<span class="mr-dot ' + (avail ? 'ok' : 'busy') + '"></span>' +
        '<button class="mr-book" type="button" data-svc="' + (kind === 'room' ? 'room' : 'vehicle') + '" data-pick="' + esc(r.name) + '" ' + (avail ? '' : 'disabled') + '>Book</button></div>';
    }).join('');
  }
  function rMeetingRooms() {
    return roomRows(DATA.rooms, 'room') + '<div class="tile-foot"><a class="tile-link-all" href="#" data-svc="room">Open room booking →</a></div>';
  }
  function rVehicles() {
    return roomRows(DATA.vehicles, 'vehicle') + '<div class="tile-foot"><a class="tile-link-all" href="#" data-svc="vehicle">Open vehicle booking →</a></div>';
  }

  /* booking modal */
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function nextHour() { var d = new Date(); d.setHours(d.getHours() + 1, 0); return ('0' + d.getHours()).slice(-2) + ':00'; }
  function openBooking(id, pick) {
    var s = svcById(id); if (!s) return;
    $('bkIc').style.background = s.color + '22'; $('bkIc').style.color = s.color; $('bkIc').innerHTML = ic(s.ic);
    $('bkTitle').textContent = s.title;
    $('bkDesc').textContent = 'Complete the form — you’ll get a confirmation reference.';
    $('bkBody').innerHTML = s.fields.map(function (f) {
      var v = '';
      if (pick && (f.k === 'room' || f.k === 'vehicle')) v = matchOption(f.options, pick);
      if (f.type === 'date') v = todayStr();
      if (f.type === 'time') v = nextHour();
      var half = (f.type === 'date' || f.type === 'time' || f.type === 'number') ? ' half' : '';
      var input;
      if (f.type === 'select') input = '<select class="bk-in" data-k="' + f.k + '">' + f.options.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      else input = '<input class="bk-in" data-k="' + f.k + '" type="' + (f.type || 'text') + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + (v ? ' value="' + esc(v) + '"' : '') + '>';
      return '<div class="bk-field' + half + '"><label>' + esc(f.label) + '</label>' + input + '</div>';
    }).join('');
    $('bkForm').dataset.prefix = s.prefix; $('bkForm').dataset.title = s.short;
    $('bkOverlay').classList.add('show');
    var first = $('bkBody').querySelector('.bk-in'); if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 60);
  }
  function matchOption(options, pick) { for (var i = 0; i < options.length; i++) { if (options[i].indexOf(pick) === 0 || pick.indexOf(options[i].split(' (')[0]) === 0) return options[i]; } return options[0]; }
  function closeBooking() { $('bkOverlay').classList.remove('show'); }
  function submitBooking(e) {
    e.preventDefault();
    var ref = ($('bkForm').dataset.prefix || 'REQ') + '-' + (1000 + Math.floor(Math.random() * 9000));
    var title = $('bkForm').dataset.title || 'Request';
    closeBooking();
    if (window.showToast) showToast(title + ' confirmed', 'Reference ' + ref + ' — a confirmation has been sent to your inbox.', 'success');
  }

  /* ---------------- Registry ---------------- */
  var W = {
    welcome:   { title: 'Welcome', section: 1, span: 12, ico: 'star',    color: '#EAB308', render: rWelcome, klass: 'hero', desc: 'Personalised greeting & headline stats.' },
    inquiries: { title: 'My Inquiries', section: 1, span: 6, ico: 'help', color: '#38BDF8', render: rInquiries, desc: 'Inquiries made and their status.' },
    devices:   { title: 'Assigned Devices', section: 1, span: 6, ico: 'laptop', color: '#4F6EF7', render: rDevices, desc: 'Company assets allocated to you.' },
    leaveatt:  { title: 'Leave & Attendance', section: 1, span: 6, ico: 'cal', color: '#22C55E', render: rLeaveAtt, desc: 'Attendance summary & trend.' },
    leaveelig: { title: 'Leave Eligibility', section: 1, span: 6, ico: 'leaf', color: '#22C55E', render: rLeaveElig, desc: 'Remaining leave balances.' },

    quick:     { title: 'Quick Actions', section: 2, span: 4, ico: 'bolt', color: '#4F46E5', render: rQuick, desc: 'Shortcuts to common actions.' },
    services:  { title: 'Book & Request', section: 2, span: 6, ico: 'grid', color: '#4F6EF7', render: rServices, desc: 'Book rooms, vehicles, passes & more.' },
    meetingrooms: { title: 'Meeting Rooms', section: 2, span: 4, ico: 'cal', color: '#4F6EF7', render: rMeetingRooms, optional: true, desc: 'Live room availability & booking.' },
    vehicles:  { title: 'Fleet & Vehicles', section: 2, span: 4, ico: 'car', color: '#EAB308', render: rVehicles, optional: true, desc: 'Book pool vehicles & shuttles.' },
    apps:      { title: 'My Applications (SSO)', section: 2, span: 4, ico: 'grid', color: '#0369A1', render: rApps, desc: 'Launch allocated apps via SSO.' },
    empsearch: { title: 'Find an Employee', section: 2, span: 4, ico: 'search', color: '#E11D48', render: rSearch, desc: 'Quick employee directory search.' },
    announce:  { title: 'Announcements', section: 2, span: 6, ico: 'mega', color: '#4F6EF7', render: rAnnounce, desc: 'Latest company announcements.' },

    /* optional extras */
    goals:     { title: 'My Goals', section: 1, span: 4, ico: 'target', color: '#4F6EF7', render: rGoals, optional: true, desc: 'Personal development goals.' },
    birthdays: { title: 'Birthdays', section: 2, span: 4, ico: 'award', color: '#EC4899', render: rBirthdays, optional: true, desc: 'Upcoming team birthdays.' },
    holidays:  { title: 'Company Holidays', section: 2, span: 4, ico: 'cal', color: '#F59E0B', render: rHolidays, optional: true, desc: 'Upcoming public holidays.' },
    notes:     { title: 'Quick Notes', section: 1, span: 4, ico: 'help', color: '#64748B', render: rNotes, optional: true, desc: 'A scratchpad for yourself.' }
  };

  var DEFAULT = {
    // Single unified grid (no sections) — order kept from the old s1 then s2.
    s1: ['welcome', 'inquiries', 'devices', 'leaveatt', 'leaveelig',
         'quick', 'services', 'apps', 'empsearch', 'announce'],
    s2: []
  };
  var KEY = 'lc-dash-v2';
  var COLS = 6;

  function loadLayout() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.s1) {
        // Migrate older two-section layouts into the single grid.
        if (s.s2 && s.s2.length) { s.s1 = s.s1.concat(s.s2); }
        s.s2 = [];
        s.sizes = s.sizes || {};
        return s;
      }
    } catch (e) {}
    return { s1: DEFAULT.s1.slice(), s2: [], sizes: {} };
  }
  function saveLayout(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }
  var layout = loadLayout();

  /* Size model — width in columns (1-6); height auto-fits content unless the
     user has explicitly resized it (then it's a fixed row-span). */
  function defW(id) { return Math.max(1, Math.min(COLS, Math.round((W[id].span || 6) / 2))); }
  function getW(id) { var s = layout.sizes[id]; return (s && s.w) || defW(id); }
  function getH(id) { var s = layout.sizes[id]; return (s && s.h) || null; }
  function setSize(id, w, h) { var s = layout.sizes[id] = layout.sizes[id] || {}; if (w != null) s.w = w; if (h !== undefined) s.h = h; saveLayout(layout); }

  // Widgets introduced after v2 — auto-add to existing saved layouts exactly once
  // (so returning users get them without losing their customisation).
  var SEEDED = ['services'];
  function ensureNew() {
    layout._seen = layout._seen || [];
    var changed = false;
    SEEDED.forEach(function (id) {
      if (layout._seen.indexOf(id) > -1) return;
      layout._seen.push(id); changed = true;
      if (layout.s1.indexOf(id) === -1) { layout.s1.push(id); }
    });
    if (changed) saveLayout(layout);
  }

  /* ---------------- Render engine ---------------- */
  var RM = '<button class="tile-tool rm" title="Remove widget" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  var SZ = '<button class="tile-tool szbtn" title="Resize width" aria-label="Resize"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>';
  var HANDLE = '<button class="tile-resize" title="Drag to resize" aria-label="Resize widget"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 10 10 20"/><path d="M20 16 16 20"/></svg></button>';

  function tileEl(id, idx) {
    var w = W[id]; if (!w) return null;
    var el = document.createElement('section');
    el.className = 'tile' + (w.klass ? ' ' + w.klass : '');
    el.dataset.id = id;
    el.style.setProperty('--i', idx);
    el.style.setProperty('--w', getW(id));
    var uh = getH(id); if (uh) el.style.setProperty('--h', uh);
    if (w.klass === 'hero') {
      el.innerHTML = '<div class="tile-body" style="position:relative">' + w.render() +
        '<header class="tile-head" draggable="true" style="position:absolute;inset:0;margin:0;background:transparent"></header>' +
        '<div class="tile-tools" style="position:absolute;top:14px;right:14px;z-index:4;color:rgba(255,255,255,.85)">' + SZ + RM + '</div></div>' + HANDLE;
    } else {
      var head = '<header class="tile-head" draggable="true">' +
        '<div class="tile-title"><span class="ti" style="background:' + w.color + '22;color:' + w.color + '">' + ic(w.ico) + '</span><span>' + esc(w.title) + '</span></div>' +
        '<div class="tile-tools"><button class="tile-tool drag" title="Drag to reorder" tabindex="-1"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>' + SZ + RM + '</div></header>';
      el.innerHTML = head + '<div class="tile-body">' + w.render() + '</div>' + HANDLE;
    }
    return el;
  }

  function render() {
    var grid = $('grid1');
    grid.innerHTML = '';
    ensureGuides(grid);
    layout.s1.forEach(function (id, i) {
      var el = tileEl(id, i);
      if (el) grid.appendChild(el);
    });
    wireGrid(grid, 's1');
    postRender();
  }

  /* ---- masonry auto-fit: give each tile a row-span that fits its content ---- */
  function ensureGuides(grid) {
    if (grid.querySelector('.bento-guides')) return;
    var g = document.createElement('div'); g.className = 'bento-guides';
    g.innerHTML = new Array(COLS + 1).join('<span></span>');
    grid.insertBefore(g, grid.firstChild);
  }
  var ROW_UNIT = 8, ROW_GAP = 16, ROW_STEP = ROW_UNIT + ROW_GAP; // 24px per row-span
  function rowsForHeight(px) { return Math.max(2, Math.ceil((px + 18) / ROW_STEP) + 1); }
  function fitHeights() {
    ['grid1', 'grid2'].forEach(function (gid) {
      var grid = $(gid); if (!grid) return;
      var kids = Array.prototype.slice.call(grid.querySelectorAll('.tile'));
      grid.classList.add('measuring');
      kids.forEach(function (t) { var h = getH(t.dataset.id); t.style.setProperty('--h', h ? h : '1'); });
      kids.forEach(function (t) {
        if (getH(t.dataset.id)) return;                 // user-set height — keep it
        t.style.setProperty('--h', rowsForHeight(t.scrollHeight));
      });
      grid.classList.remove('measuring');
    });
  }

  /* Charts that must fill their tile's width are rendered into slots and
     (re)generated at the slot's actual pixel size, so they scale with the
     widget instead of ballooning. */
  var CHART = {
    leaveatt: function (w, h) {
      var d = DATA.attendance.monthly.map(function (m) { return { label: m.d, value: m.h, highlight: m.hi }; });
      return C.vbars(d, { w: w, h: h, max: 100, color: '#22C55E', accent: '#16A34A' });
    }
  };
  function sizeCharts() {
    Array.prototype.forEach.call(document.querySelectorAll('.chart-slot'), function (slot) {
      var type = slot.dataset.chart; if (!CHART[type]) return;
      var w = Math.max(160, Math.round(slot.clientWidth || slot.getBoundingClientRect().width));
      if (!w) return;
      var h = Math.max(120, Math.min(210, Math.round(w * 0.42)));
      slot.innerHTML = CHART[type](w, h);
    });
  }
  var reflowT;
  function reflow() { clearTimeout(reflowT); reflowT = setTimeout(function () { sizeCharts(); fitHeights(); }, 30); }

  /* count-ups, gauge draw, interactions after (re)render */
  function postRender() {
    // count-ups
    Array.prototype.forEach.call(document.querySelectorAll('.num[data-to]'), function (el) {
      if (el.dataset.done) return; el.dataset.done = '1';
      countUp(el);
    });
    // gauge draw (transition from empty)
    Array.prototype.forEach.call(document.querySelectorAll('.lc-gauge-fill'), function (el) {
      var final = el.getAttribute('stroke-dashoffset');
      var full = el.getAttribute('stroke-dasharray');
      el.setAttribute('stroke-dashoffset', full);
      // force reflow then animate to final
      void el.getBoundingClientRect();
      setTimeout(function () { el.setAttribute('stroke-dashoffset', final); }, 60);
    });
    wireEmpSearch();
    wireApps();
    wireNotes();
    sizeCharts();     // size chart SVGs to their slot width first…
    fitHeights();     // …then fit tile heights to the resulting content
    wireResizeHandles();
  }

  /* ---- drag-to-resize (corner handle) + width popover ---- */
  function wireResizeHandles() {
    Array.prototype.forEach.call(document.querySelectorAll('.tile-resize'), function (h) {
      if (h._wired) return; h._wired = true;
      h.addEventListener('pointerdown', function (e) { startResize(e, h.closest('.tile')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tile-tool.szbtn'), function (b) {
      if (b._wired) return; b._wired = true;
      b.addEventListener('click', function (e) { e.stopPropagation(); openSizePop(b.closest('.tile')); });
    });
  }

  function startResize(e, tile) {
    if (!tile) return;
    e.preventDefault(); e.stopPropagation();
    var grid = tile.parentElement;
    var gr = grid.getBoundingClientRect();
    var cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || COLS;
    var colW = (gr.width - ROW_GAP * (cols - 1)) / cols;
    var tr = tile.getBoundingClientRect();
    var id = tile.dataset.id;
    grid.classList.add('guiding'); tile.classList.add('resizing');
    document.body.style.cursor = 'nwse-resize';
    var target = { w: getW(id), h: null };
    function move(ev) {
      var w = Math.max(1, Math.min(cols, Math.round((ev.clientX - tr.left + ROW_GAP) / (colW + ROW_GAP))));
      var rows = Math.max(6, Math.min(80, Math.round((ev.clientY - tr.top) / ROW_STEP)));
      target.w = w; target.h = rows;
      tile.style.setProperty('--w', w);
      tile.style.setProperty('--h', rows);
    }
    function up() {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      grid.classList.remove('guiding'); tile.classList.remove('resizing');
      document.body.style.cursor = '';
      setSize(id, target.w, target.h);
      // width changed → charts re-fill, then heights re-fit
      sizeCharts(); fitHeights();
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  var sizePopTile = null;
  function openSizePop(tile) {
    var pop = $('sizePop'), chips = $('sizeChips'); if (!pop || !tile) return;
    if (sizePopTile === tile && pop.classList.contains('show')) { pop.classList.remove('show'); sizePopTile = null; return; }
    sizePopTile = tile;
    var cur = getW(tile.dataset.id);
    var html = '';
    for (var i = 1; i <= COLS; i++) html += '<button class="size-chip' + (i === cur ? ' active' : '') + '" data-w="' + i + '">' + i + '</button>';
    chips.innerHTML = html;
    pop.classList.add('show');
    var b = tile.querySelector('.szbtn').getBoundingClientRect();
    var pw = pop.offsetWidth || 190;
    var left = Math.min(window.innerWidth - pw - 12, Math.max(12, b.left + window.scrollX - pw + 30));
    pop.style.left = left + 'px';
    pop.style.top = (b.bottom + window.scrollY + 8) + 'px';
  }

  function countUp(el) {
    var to = parseFloat(el.dataset.to) || 0, dec = parseInt(el.dataset.dec || '0', 10), suf = el.dataset.suf || '', pre = el.dataset.pre || '';
    var dur = 900, start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    function now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
    function fmt(v) { return pre + v.toFixed(dec) + suf; }
    el.textContent = fmt(0);
    // Timer-driven (not rAF) so numbers always reach their final value even when
    // the tab is backgrounded / rAF is throttled.
    var iv = setInterval(function () {
      var p = Math.min(1, (now() - start) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p >= 1) { clearInterval(iv); el.textContent = fmt(to); }
    }, 32);
  }

  /* ---------------- Interactions ---------------- */
  function wireGrid(grid, sec) {
    if (!grid._wired) {
      grid._wired = true;
      grid.addEventListener('click', function (e) {
        var rm = e.target.closest('.tile-tool.rm'); if (rm) { var tile = rm.closest('.tile'); removeWidget(tile.dataset.id); }
      });
      grid.addEventListener('dragover', function (e) {
        e.preventDefault();
        var dragging = grid._drag; if (!dragging) return;
        var after = afterElement(grid, e.clientX, e.clientY);
        if (after == null) grid.appendChild(dragging);
        else grid.insertBefore(dragging, after);
      });
    }
    // (re)wire drag handles on the freshly-rendered tiles
    var heads = grid.querySelectorAll('.tile-head');
    Array.prototype.forEach.call(heads, function (h) {
      h.addEventListener('dragstart', function (e) {
        var tile = h.closest('.tile'); tile.classList.add('dragging');
        grid._drag = tile; e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', tile.dataset.id); } catch (er) {}
      });
      h.addEventListener('dragend', function () {
        var tile = h.closest('.tile'); tile.classList.remove('dragging');
        grid._drag = null; persistFromDom();
      });
    });
  }
  function afterElement(grid, x, y) {
    var els = Array.prototype.slice.call(grid.querySelectorAll('.tile:not(.dragging)'));
    var closest = null, closestDist = Infinity;
    els.forEach(function (el) {
      var b = el.getBoundingClientRect();
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      // prefer same-row (y close), then x
      var d = Math.hypot(x - cx, (y - cy) * 1.4);
      if ((y < cy || (Math.abs(y - cy) < b.height / 2 && x < cx)) && d < closestDist) { closestDist = d; closest = el; }
    });
    return closest;
  }
  function persistFromDom() {
    layout.s1 = Array.prototype.map.call($('grid1').querySelectorAll('.tile'), function (t) { return t.dataset.id; });
    layout.s2 = [];
    saveLayout(layout);
  }

  function removeWidget(id) {
    ['s1', 's2'].forEach(function (s) { var i = layout[s].indexOf(id); if (i > -1) layout[s].splice(i, 1); });
    saveLayout(layout); render();
    if (window.showToast) showToast('Widget removed', 'Add it back anytime from “Add widget”.', 'info');
  }
  function addWidget(id) {
    var w = W[id]; if (!w) return;
    if (layout.s1.indexOf(id) === -1) layout.s1.push(id);
    saveLayout(layout); render();
    closeModal();
    if (window.showToast) showToast('Widget added', esc(w.title) + ' added to your dashboard.', 'success');
    // scroll to it
    setTimeout(function () { var el = document.querySelector('.tile[data-id="' + id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
  }

  /* Add-widget modal */
  function openModal() {
    var used = layout.s1.concat(layout.s2);
    var avail = Object.keys(W).filter(function (id) { return used.indexOf(id) === -1; });
    var grid = $('wmGrid');
    if (!avail.length) { grid.innerHTML = '<div class="wm-empty">🎉 All widgets are already on your dashboard.</div>'; }
    else {
      grid.innerHTML = avail.map(function (id) {
        var w = W[id];
        return '<div class="wm-card" data-add="' + id + '"><span class="ic" style="background:' + w.color + '22;color:' + w.color + '">' + ic(w.ico) + '</span>' +
          '<div><h4>' + esc(w.title) + '</h4><p>' + esc(w.desc || '') + '</p></div>' +
          '<span class="add"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:18px;height:18px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></div>';
      }).join('');
    }
    $('wmOverlay').classList.add('show');
  }
  function closeModal() { $('wmOverlay').classList.remove('show'); }

  /* employee search */
  function wireEmpSearch() {
    var input = $('empSearch'), out = $('empResults'); if (!input || !out) return;
    function draw(q) {
      var list = q ? DATA.employees.filter(function (e) { return (e.n + ' ' + e.r).toLowerCase().indexOf(q.toLowerCase()) > -1; }) : DATA.employees.slice(0, 4);
      out.innerHTML = list.length ? list.slice(0, 5).map(function (e) {
        return '<a class="es-r" href="employee-directory.html"><div class="es-av" style="background:' + e.bg + '">' + e.i + '</div><div style="flex:1"><div class="es-n">' + esc(e.n) + '</div><div class="es-role">' + esc(e.r) + '</div></div></a>';
      }).join('') : '<div style="padding:14px;text-align:center;color:var(--text-tertiary);font-size:12.5px">No matches</div>';
    }
    input.addEventListener('input', function () { draw(input.value.trim()); });
    draw('');
  }
  function wireApps() {
    Array.prototype.forEach.call(document.querySelectorAll('.app[data-app]'), function (a) {
      a.addEventListener('click', function () { if (window.showToast) showToast('Opening ' + a.dataset.app, 'Signing you in securely via SSO…', 'info'); });
    });
  }
  function wireNotes() {
    var ta = $('dashNotes'); if (!ta) return;
    try { ta.value = localStorage.getItem('lc-dash-notes') || ''; } catch (e) {}
    ta.addEventListener('input', function () { try { localStorage.setItem('lc-dash-notes', ta.value); } catch (e) {} });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    // greeting
    var hr = new Date().getHours();
    var g = $('greeting'); if (g) g.textContent = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
    var fn = $('firstName'); if (fn) fn.textContent = DATA.user.first;
    var tl = $('todayLine'); if (tl) tl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' · drag tiles to rearrange, or add your own.';

    ensureNew();
    render();

    $('addBtn').addEventListener('click', openModal);
    $('wmClose').addEventListener('click', closeModal);
    $('wmOverlay').addEventListener('click', function (e) { if (e.target === $('wmOverlay')) closeModal(); });
    $('wmGrid').addEventListener('click', function (e) { var c = e.target.closest('.wm-card[data-add]'); if (c) addWidget(c.dataset.add); });
    $('resetBtn').addEventListener('click', function () {
      layout = { s1: DEFAULT.s1.slice(), s2: [], sizes: {} }; saveLayout(layout); render();
      if (window.showToast) showToast('Layout reset', 'Widget sizes and arrangement restored to default.', 'info');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeSizePop(); closeBooking(); } });

    // workplace-service booking: open the modal from hub tiles / room+vehicle "Book"
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-svc]'); if (!el || el.disabled) return;
      e.preventDefault();
      openBooking(el.getAttribute('data-svc'), el.getAttribute('data-pick') || null);
    });
    $('bkClose').addEventListener('click', closeBooking);
    $('bkCancel').addEventListener('click', closeBooking);
    $('bkOverlay').addEventListener('click', function (e) { if (e.target === $('bkOverlay')) closeBooking(); });
    $('bkForm').addEventListener('submit', submitBooking);

    // size popover: chip click sets width; click outside closes
    $('sizeChips').addEventListener('click', function (e) {
      var chip = e.target.closest('.size-chip'); if (!chip || !sizePopTile) return;
      var id = sizePopTile.dataset.id, w = parseInt(chip.getAttribute('data-w'), 10);
      sizePopTile.style.setProperty('--w', w);
      setSize(id, w, getH(id));  // keep existing height mode
      Array.prototype.forEach.call($('sizeChips').children, function (c) { c.classList.toggle('active', c === chip); });
      sizeCharts(); fitHeights();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!$('sizePop').contains(e.target) && !e.target.closest('.szbtn')) closeSizePop();
    });

    // reflow charts + masonry when the frame width changes (columns collapse etc.)
    window.addEventListener('resize', reflow);

    window.addEventListener('load', function () {
      setTimeout(function () { if (window.showToast) showToast('Welcome back, ' + DATA.user.first + '! 👋', 'Drag a tile’s corner to resize it across the 6 columns.', 'info'); }, 700);
    });
  }
  function closeSizePop() { var p = document.getElementById('sizePop'); if (p) p.classList.remove('show'); sizePopTile = null; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
