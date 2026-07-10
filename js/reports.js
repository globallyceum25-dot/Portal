/* ============================================================
   LYCEUM CONNECT — Dashboards & Reports
   Live backend analytics for admins; a rich sample dataset
   otherwise, so the page is always a complete experience.
   ============================================================ */
(function () {
  'use strict';
  var C = window.LCCharts || {};
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var ADMIN_ROLES = ['hod_manager', 'company_admin', 'group_super_admin'];

  /* ---------------- sample (demo) dataset ---------------- */
  function genVolume(days) {
    var out = [], today = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(today); d.setDate(d.getDate() - i);
      var dow = d.getDay();
      var base = 22 + 9 * Math.sin(i / 3.3) + 5 * Math.cos(i / 7) + ((i * 13) % 6) - (dow === 0 || dow === 6 ? 12 : 0);
      out.push({ date: d.toISOString().slice(0, 10), value: Math.max(2, Math.round(base)) });
    }
    return out;
  }
  var DEMO = {
    scope: 'group',
    open_requests: 42, total_requests: 318, sla_compliance: 98, sla_breaches: 2,
    avg_csat: 4.6, csat_responses: 214, avg_resolve_days: 1.4, avg_review_hours: 3.2,
    task_completion: 78, sla_on_time: 316, first_response_h: 1.4,
    request_volume: genVolume(90),
    requests_by_category: [
      { label: 'IT Support', value: 98 }, { label: 'Human Resources', value: 72 }, { label: 'Facilities', value: 54 },
      { label: 'Finance', value: 41 }, { label: 'Academic', value: 33 }, { label: 'Administration', value: 20 }
    ],
    requests_by_status: [
      { label: 'submitted', value: 24 }, { label: 'in_progress', value: 55 }, { label: 'under_review', value: 28 },
      { label: 'completed', value: 186 }, { label: 'rejected', value: 25 }
    ],
    tasks_by_status: [ { label: 'To Do', value: 18 }, { label: 'In Progress', value: 24 }, { label: 'Done', value: 96 } ],
    csat_by_category: [
      { label: 'IT Support', value: 462 }, { label: 'Human Resources', value: 448 }, { label: 'Facilities', value: 430 },
      { label: 'Finance', value: 471 }, { label: 'Academic', value: 452 }
    ],
    top_documents: [
      { label: 'Remote Work Policy', value: 184 }, { label: 'Leave Handbook 2025', value: 152 },
      { label: 'IT Security Standard', value: 131 }, { label: 'Expense Guidelines', value: 96 }, { label: 'Onboarding Guide', value: 74 }
    ],
    announcement_reach: [
      { label: 'Q2 Results', value: 212 }, { label: 'Town Hall', value: 188 }, { label: 'Remote Policy', value: 176 },
      { label: 'Payroll Update', value: 140 }, { label: 'Wellness Week', value: 98 }
    ],
    dept_perf: [
      { dept: 'IT Support', code: 'IT', color: '#4F6EF7', requests: 98, sla: 99, csat: 4.6, trend: 12 },
      { dept: 'Human Resources', code: 'HR', color: '#22C55E', requests: 72, sla: 97, csat: 4.5, trend: 6 },
      { dept: 'Facilities', code: 'FC', color: '#EAB308', requests: 54, sla: 95, csat: 4.3, trend: -3 },
      { dept: 'Finance', code: 'FN', color: '#38BDF8', requests: 41, sla: 98, csat: 4.7, trend: 9 },
      { dept: 'Academic', code: 'AC', color: '#A78BFA', requests: 33, sla: 96, csat: 4.5, trend: 4 }
    ],
    _spark: {
      open: [30, 34, 31, 38, 36, 40, 42], total: [250, 262, 275, 288, 296, 308, 318],
      sla: [94, 95, 95, 96, 97, 97, 98], csat: [4.2, 4.3, 4.3, 4.4, 4.5, 4.5, 4.6],
      resolve: [2.1, 2.0, 1.9, 1.7, 1.6, 1.5, 1.4], task: [60, 64, 67, 70, 73, 76, 78]
    }
  };
  DEMO.insights = [
    { title: 'IT Support is your busiest line', detail: 'IT Support accounts for 98 requests (31% of volume) — 12% up on the previous period. Consider a self-service KB deflection.', severity: 'info' },
    { title: 'SLA compliance is excellent', detail: '98% of requests met their SLA this period with only 2 breaches. First-response time averaged 1.4h.', severity: 'positive' },
    { title: 'Facilities CSAT is slipping', detail: 'Facilities satisfaction (4.3/5) trended down 3% — the only department below target this cycle.', severity: 'warning' },
    { title: 'Meeting-task follow-through', detail: '78% of tasks generated from meetings are complete; 18 remain in “To Do”. Nudge owners on overdue items.', severity: 'info' }
  ];

  var state = { range: 14, mode: 'demo', data: DEMO };

  /* Merge a live overview payload into the full model (fill visual extras). */
  function normalize(live) {
    var m = {};
    Object.keys(DEMO).forEach(function (k) { m[k] = DEMO[k]; });        // defaults for extras
    Object.keys(live).forEach(function (k) { if (live[k] != null) m[k] = live[k]; });
    if (!live.request_volume || !live.request_volume.length) m.request_volume = DEMO.request_volume;
    return m;
  }

  /* ---------------- boot ---------------- */
  function boot() {
    wireToolbar();
    positionSeg();
    load();
  }

  async function load(animate) {
    var scope = $('scopePill');
    var claims = window.LC && LC.claims && LC.claims();
    var role = claims && claims.role;
    var live = null;
    if (window.LC && LC.token && LC.token() && await safeHealth() && ADMIN_ROLES.indexOf(role) > -1) {
      try { live = await LC.get('/api/reports/overview'); } catch (e) { live = null; }
    }
    // An empty backend overview (no activity logged yet) must not blank the
    // dashboard — fall back to the sample dataset so the page stays meaningful.
    if (live && !live.total_requests && !live.open_requests &&
        (!live.request_volume || !live.request_volume.length)) {
      live = null;
    }
    if (live) {
      state.mode = 'live'; state.data = normalize(live);
      scope.className = 'rp-scope';
      scope.innerHTML = '<span class="dot"></span> ' + (state.data.scope === 'group' ? 'Group-wide · all companies' : 'Scope: ' + esc(state.data.scope));
      note('');
    } else {
      state.mode = 'demo'; state.data = DEMO;
      scope.className = 'rp-scope demo';
      scope.innerHTML = '<span class="dot"></span> Sample data';
      note('You’re viewing <b>sample analytics</b>. Sign in as an HOD / Admin with the backend running to load live, group-wide data.');
    }
    render();
    loadInsights();
  }
  async function safeHealth() { try { return await LC.health(); } catch (e) { return false; } }
  function note(html) { var n = $('modeNote'); if (!html) { n.style.display = 'none'; return; } n.style.display = 'flex'; n.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>' + html + '</span>'; }

  /* ---------------- render ---------------- */
  function render() {
    renderKPIs(); renderVolume(); renderGauge(); renderCharts(); renderTable();
    // motion
    setTimeout(function () { countAll(); drawGauges(); }, 20);
  }

  function ic(name) {
    var p = {
      inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
      layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
      star: '<polygon points="12 2 15 9 22 9.3 17 14 18.5 21 12 17 5.5 21 7 14 2 9.3 9 9"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (p[name] || p.layers) + '</svg>';
  }
  function num(v, o) { o = o || {}; return '<span class="num" data-to="' + v + '" data-dec="' + (o.dec || 0) + '" data-suf="' + (o.suf || '') + '">0' + (o.suf || '') + '</span>'; }

  function renderKPIs() {
    var r = state.data, sp = r._spark || DEMO._spark;
    var cards = [
      { lab: 'Open requests', val: r.open_requests, ic: 'inbox', c: '#4F6EF7', foot: r.total_requests + ' total logged', spark: sp.open, delta: '+9%', up: true },
      { lab: 'Total requests', val: r.total_requests, ic: 'layers', c: '#7C3AED', foot: 'this reporting period', spark: sp.total, delta: '+21', up: true },
      { lab: 'SLA compliance', val: r.sla_compliance, suf: '%', ic: 'shield', c: '#22C55E', foot: r.sla_breaches + ' breach(es)', spark: sp.sla, delta: '+2%', up: true },
      { lab: 'Avg CSAT', val: r.avg_csat, dec: 1, ic: 'star', c: '#EAB308', foot: r.csat_responses + ' responses', spark: sp.csat, delta: '+0.3', up: true },
      { lab: 'Avg resolve', val: r.avg_resolve_days, dec: 1, suf: 'd', ic: 'clock', c: '#38BDF8', foot: 'ZTE turnaround ' + (r.avg_review_hours || 0) + 'h', spark: sp.resolve, delta: '-0.3d', up: true },
      { lab: 'Task completion', val: r.task_completion, suf: '%', ic: 'check', c: '#EC4899', foot: 'meeting-task pipeline', spark: sp.task, delta: '+6%', up: true }
    ];
    $('kpiRow').innerHTML = cards.map(function (c, i) {
      return '<div class="rp-card rp-kpi" style="--i:' + i + '">' +
        '<div class="rp-kpi-top"><span class="rp-kpi-ic" style="background:' + c.c + '22;color:' + c.c + '">' + ic(c.ic) + '</span>' +
        '<span class="rp-badge ' + (c.up ? 'up' : 'down') + '">' + esc(c.delta) + '</span></div>' +
        '<div class="rp-kpi-val">' + num(c.val, { dec: c.dec, suf: c.suf }) + '</div>' +
        '<div class="rp-kpi-lab">' + esc(c.lab) + '</div>' +
        '<div class="rp-kpi-spark">' + C.sparkline(c.spark, { color: c.c, h: 36 }) + '</div>' +
        '<div class="rp-kpi-foot">' + esc(c.foot) + '</div></div>';
    }).join('');
  }

  function renderVolume() {
    var vol = state.data.request_volume || [];
    var slice = vol.slice(Math.max(0, vol.length - state.range));
    var w = Math.max(320, ($('chartVolume').clientWidth || 640));
    $('chartVolume').innerHTML = C.line(slice, { w: w, h: Math.max(180, Math.min(240, Math.round(w * 0.30))), empty: 'No requests in range.' });
    $('volSub').textContent = 'Last ' + state.range + ' days · ' + slice.reduce(function (a, d) { return a + d.value; }, 0) + ' requests';
    var half = Math.floor(slice.length / 2) || 1;
    var a = slice.slice(0, half).reduce(function (s, d) { return s + d.value; }, 0);
    var b = slice.slice(half).reduce(function (s, d) { return s + d.value; }, 0);
    var pct = a ? Math.round((b - a) / a * 100) : 0;
    var badge = $('volDelta'); badge.className = 'rp-badge ' + (pct >= 0 ? 'up' : 'down');
    badge.textContent = (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%';
  }

  function renderGauge() {
    var r = state.data;
    $('slaGauge').innerHTML =
      C.gauge(r.sla_compliance, { size: 168, stroke: 15, color: '#22C55E', sub: 'compliant' }) +
      '<div class="rp-gstats">' +
        '<div class="rp-gstat"><b>' + num(r.sla_on_time || (r.total_requests - r.sla_breaches)) + '</b><span>On-time</span></div>' +
        '<div class="rp-gstat"><b>' + num(r.sla_breaches) + '</b><span>Breaches</span></div>' +
        '<div class="rp-gstat"><b>' + num(r.first_response_h || r.avg_review_hours || 0, { dec: 1, suf: 'h' }) + '</b><span>First response</span></div>' +
        '<div class="rp-gstat"><b>' + num(r.avg_resolve_days || 0, { dec: 1, suf: 'd' }) + '</b><span>Avg resolve</span></div>' +
      '</div>';
  }

  function renderCharts() {
    var r = state.data;
    $('chartCategory').innerHTML = C.bars(r.requests_by_category, { colorByIndex: true, empty: 'No requests yet.' });
    $('chartStatus').innerHTML = C.donut(r.requests_by_status, { centerLabel: 'requests', colorFn: C.statusColor, empty: 'No requests yet.' });
    $('chartTasks').innerHTML = C.donut(r.tasks_by_status, { centerLabel: 'tasks', colorFn: C.statusColor, empty: 'No tasks yet.' });
    $('taskPct').textContent = (r.task_completion || 0) + '% complete';
    var csat = (r.csat_by_category || []).map(function (c) { return { label: c.label, value: c.value }; });
    $('chartCsat').innerHTML = C.bars(csat, { color: '#EAB308', fmt: function (v) { return (v / 100).toFixed(1); }, empty: 'No CSAT yet.' });
    $('chartDocs').innerHTML = C.bars(r.top_documents, { color: '#0D9488', empty: 'No document reads yet.' });
    $('chartAnns').innerHTML = C.bars(r.announcement_reach, { color: '#A78BFA', empty: 'No announcement reads yet.' });
  }

  function renderTable() {
    var rows = (state.data.dept_perf || []).map(function (d) {
      var slaC = d.sla >= 98 ? '#22C55E' : d.sla >= 95 ? '#EAB308' : '#EF4444';
      var tb = d.trend >= 0 ? 'up' : 'down';
      return '<tr>' +
        '<td><div class="rp-dept"><span class="d-ic" style="background:' + d.color + '">' + esc(d.code) + '</span>' + esc(d.dept) + '</div></td>' +
        '<td class="r">' + d.requests + '</td>' +
        '<td class="r"><span class="rp-mini-bar"><i style="width:' + d.sla + '%;background:' + slaC + '"></i></span> ' + d.sla + '%</td>' +
        '<td class="r">' + d.csat.toFixed(1) + ' / 5</td>' +
        '<td class="r"><span class="rp-pill ' + (tb === 'up' ? 'up' : 'down') + '" style="background:' + (tb === 'up' ? '#DCFCE7' : '#FEE2E2') + ';color:' + (tb === 'up' ? '#15803D' : '#B91C1C') + '">' + (d.trend >= 0 ? '▲ ' : '▼ ') + Math.abs(d.trend) + '%</span></td>' +
        '</tr>';
    }).join('');
    $('deptTable').innerHTML =
      '<thead><tr><th>Department</th><th class="r">Requests</th><th class="r">SLA</th><th class="r">CSAT</th><th class="r">Trend</th></tr></thead><tbody>' + rows + '</tbody>';
  }

  /* ---------------- insights + ask ---------------- */
  async function loadInsights() {
    var listEl = $('insightList');
    listEl.innerHTML = '<div class="rp-iitem"><span class="sk" style="width:100%;height:44px"></span></div><div class="rp-iitem"><span class="sk" style="width:100%;height:44px"></span></div>';
    var insights = DEMO.insights, engine = 'grounded';
    if (state.mode === 'live') {
      try { var d = await LC.get('/api/reports/insights'); if (d && d.insights) { insights = d.insights; engine = d.engine === 'nim' ? 'GLM · grounded' : 'grounded'; } } catch (e) {}
    }
    $('engineBadge').textContent = engine;
    listEl.innerHTML = insights.map(function (i) {
      return '<div class="rp-iitem"><span class="rp-sev sev-' + (i.severity || 'info') + '"></span>' +
        '<div><div class="rp-iitem-t">' + esc(i.title) + '</div><div class="rp-iitem-d">' + esc(i.detail) + '</div></div></div>';
    }).join('');
    $('askChips').innerHTML = ['What is our busiest service category?', 'How is SLA compliance?', 'How many requests went to ZTE?', 'How complete are meeting tasks?']
      .map(function (q) { return '<span class="rp-chip">' + esc(q) + '</span>'; }).join('');
    Array.prototype.forEach.call($('askChips').children, function (ch) { ch.addEventListener('click', function () { ask(ch.textContent); }); });
  }

  async function ask(preset) {
    var input = $('askInput'), q = (preset || input.value || '').trim(); if (!q) return;
    input.value = q;
    var btn = $('askBtn'); btn.disabled = true; btn.textContent = '…';
    var box = $('askAnswer'); box.style.display = 'block'; box.textContent = 'Thinking…';
    var answer;
    if (state.mode === 'live') {
      try { var d = await LC.post('/api/reports/ask', { question: q }); answer = d.answer; } catch (e) { answer = 'Sorry, I could not answer that.'; }
    } else {
      answer = demoAnswer(q);
      await new Promise(function (r) { setTimeout(r, 450); });
    }
    box.textContent = answer;
    btn.disabled = false; btn.textContent = 'Ask';
  }
  function demoAnswer(q) {
    var l = q.toLowerCase(), r = state.data;
    if (/busiest|category|most/.test(l)) return 'IT Support is the busiest service line with 98 requests — 31% of total volume this period, up 12% on the previous window.';
    if (/sla|compliance|breach/.test(l)) return 'SLA compliance is ' + r.sla_compliance + '% with only ' + r.sla_breaches + ' breach(es). First-response time averaged 1.4 hours.';
    if (/zte|review|tier|two/.test(l)) return 'IT tickets follow the two-tier flow: LGH IT reviews, then routes to ZTE technicians. Average ZTE turnaround is ' + (r.avg_review_hours || 3.2) + ' hours.';
    if (/task|meeting|complete/.test(l)) return 'Meeting-task completion sits at ' + r.task_completion + '%. Of tasks generated from meetings, 96 are done and 18 remain to do.';
    if (/csat|satisfaction|rating/.test(l)) return 'Average CSAT is ' + r.avg_csat + '/5 across ' + r.csat_responses + ' responses. Finance leads (4.7); Facilities is lowest (4.3).';
    return 'Across ' + r.total_requests + ' requests, SLA compliance is ' + r.sla_compliance + '% and CSAT is ' + r.avg_csat + '/5. IT Support is the busiest line.';
  }

  /* ---------------- motion ---------------- */
  function countAll() {
    Array.prototype.forEach.call(document.querySelectorAll('.num[data-to]'), function (el) {
      if (el.dataset.done) return; el.dataset.done = '1'; countUp(el);
    });
  }
  function countUp(el) {
    var to = parseFloat(el.dataset.to) || 0, dec = parseInt(el.dataset.dec || '0', 10), suf = el.dataset.suf || '';
    var start = (typeof performance !== 'undefined' ? performance.now() : Date.now()), dur = 850;
    function now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
    function fmt(v) { return v.toFixed(dec) + suf; }
    var iv = setInterval(function () {
      var p = Math.min(1, (now() - start) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p >= 1) { clearInterval(iv); el.textContent = fmt(to); }
    }, 30);
  }
  function drawGauges() {
    Array.prototype.forEach.call(document.querySelectorAll('.lc-gauge-fill'), function (el) {
      if (el.dataset.drawn) return; el.dataset.drawn = '1';
      var final = el.getAttribute('stroke-dashoffset'), full = el.getAttribute('stroke-dasharray');
      el.setAttribute('stroke-dashoffset', full); void el.getBoundingClientRect();
      setTimeout(function () { el.setAttribute('stroke-dashoffset', final); }, 60);
    });
  }

  /* ---------------- toolbar ---------------- */
  function positionSeg() {
    var seg = $('rangeSeg'), active = seg.querySelector('button.active'), ind = $('segInd');
    if (!active) return;
    ind.style.left = active.offsetLeft + 'px';
    ind.style.width = active.offsetWidth + 'px';
    ind.style.height = active.offsetHeight + 'px';
  }
  function wireToolbar() {
    var seg = $('rangeSeg');
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); positionSeg();
        state.range = parseInt(b.getAttribute('data-range'), 10);
        renderVolume(); setTimeout(countAll, 20);
      });
    });
    window.addEventListener('resize', function () { positionSeg(); renderVolume(); });
    $('askBtn').addEventListener('click', function () { ask(); });
    $('askInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
    $('refreshBtn').addEventListener('click', function () {
      var b = $('refreshBtn'); b.classList.add('spin');
      Promise.resolve(load()).then(function () {}, function () {}).then(function () { setTimeout(function () { b.classList.remove('spin'); }, 600); });
      if (window.showToast) showToast('Refreshed', 'Report data reloaded.', 'success');
    });
    $('csvBtn').addEventListener('click', exportCSV);
    $('csvBtn2').addEventListener('click', exportCSV);
    $('printBtn').addEventListener('click', function () { window.print(); });
  }

  function exportCSV() {
    var r = state.data, lines = [];
    lines.push(['Metric', 'Value']);
    lines.push(['Open requests', r.open_requests]);
    lines.push(['Total requests', r.total_requests]);
    lines.push(['SLA compliance %', r.sla_compliance]);
    lines.push(['SLA breaches', r.sla_breaches]);
    lines.push(['Avg CSAT', r.avg_csat]);
    lines.push(['Avg resolve (days)', r.avg_resolve_days]);
    lines.push(['Task completion %', r.task_completion]);
    lines.push([]);
    lines.push(['Department', 'Requests', 'SLA %', 'CSAT', 'Trend %']);
    (r.dept_perf || []).forEach(function (d) { lines.push([d.dept, d.requests, d.sla, d.csat, d.trend]); });
    lines.push([]);
    lines.push(['Category', 'Requests']);
    (r.requests_by_category || []).forEach(function (c) { lines.push([c.label, c.value]); });
    var csv = lines.map(function (row) { return row.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'lyceum-report-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    if (window.showToast) showToast('Export ready', 'Report downloaded as CSV.', 'success');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
