/* ============================================================
   LYCEUM CONNECT — Per-employee dashboard (Phase 5+)
   Opened from the directory (employee.html?id=…). Loads the
   employee + department peers from the API (offline fallback
   generates them), derives stable per-person analytics from a
   hash of the id, and renders an animated HR dashboard:
   profile hero, stat tiles, KPI bars, weekly work-time chart,
   circular work timer, onboarding progress, team top performers,
   weekly schedule and collapsible detail sections.
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var qs = new URLSearchParams(location.search);
  var id = qs.get('id') || 'emp_001';
  var useApi = false;

  async function init() {
    try { useApi = !!(window.LC && LC.token() && await LC.health()); } catch (e) { useApi = false; }
    var emp;
    try {
      if (useApi) {
        emp = await LC.get('/api/directory/' + encodeURIComponent(id));
      } else { throw new Error('offline'); }
    } catch (e) {
      var roster = genRoster(140);
      emp = roster.find(function (x) { return x.id === id; }) || roster[0];
    }
    render(emp);
  }

  /* ---------- deterministic derived analytics ---------- */
  function analytics(emp) {
    var h = hash(strHash(emp.id));
    var rnd = function (shift, min, max) { return min + ((h >>> shift) % (max - min + 1)); };
    var senior = emp.category === 'Management';

    var week = []; var totalMin = 0; var peak = 0, peakVal = 0;
    for (var d = 0; d < 7; d++) {
      var weekend = (d === 0 || d === 6);
      var m = weekend ? rnd(d * 3, 0, 120) : rnd(d * 3, 180, 330);
      week.push(m); totalMin += m;
      if (m > peakVal) { peakVal = m; peak = d; }
    }
    var ringMin = rnd(2, 150, 320);
    var onboard = senior ? 100 : rnd(5, 18, 92);
    return {
      week: week, peak: peak, peakVal: peakVal,
      totalH: (totalMin / 60),
      ring: { min: ringMin, pct: ringMin / 480 },
      onboarding: onboard,
      projects: rnd(8, 3, 24),
      tasksDone: rnd(11, 18, 60), tasksTotal: 0,
      attendance: rnd(14, 88, 99),
      onTime: rnd(17, 80, 98),
      utilization: rnd(20, 62, 95),
      tenure: tenure(emp.joining_date),
      device: ['MacBook Air · M4', 'MacBook Pro · M3', 'Dell XPS 15', 'ThinkPad X1'][h % 4],
      salaryBand: ['B3', 'B4', 'M1', 'M2'][h % 4],
      leave: rnd(9, 4, 18)
    };
  }

  /* ---------- render ---------- */
  function render(emp) {
    document.getElementById('crumbName').textContent = emp.name;
    document.title = emp.name + ' — Lyceum Connect';
    var a = analytics(emp); a.tasksTotal = a.tasksDone + ((hash(strHash(emp.id)) >>> 4) % 20) + 6;
    emp._co = companyFor(emp);
    var av = avatarStyle(emp);
    var days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    var grid = document.getElementById('dashGrid');
    var i = 0;
    var html = '';

    /* Row 1: stat tiles + KPI bars */
    html += widget('col-8', i++,
      '<div class="stat-tiles">' +
        tile('projects', a.projects, 'Projects', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>') +
        tile('tasks', a.tasksDone, 'Tasks Done', '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>') +
        tileText('attend', a.attendance + '%', 'Attendance', '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>') +
      '</div>', 'Overview', '');

    html += widget('col-4', i++,
      '<div class="kpi-row">' +
        kpi('Attendance', a.attendance, 'var(--gray-800)') +
        kpi('On-time', a.onTime, 'var(--primary)') +
        kpi('Utilization', a.utilization, 'var(--primary-light)') +
      '</div>', 'Performance', 'This month');

    /* Row 2: hero, work-time bars, ring, onboarding */
    html += '' +
      '<div class="hero col-3" style="--i:' + (i++) + '">' +
        '<div class="hero-bg" style="' + av + '"><img class="hero-photo" src="' + photoURL(emp) + '" alt="" onload="this.closest(\'.hero\').classList.add(\'has-photo\')" onerror="this.remove()"></div>' +
        '<div class="hero-mark"><span>' + esc(emp.initials) + '</span></div>' +
        (emp.online ? '<div class="hero-chip"><span class="dot"></span> Online</div>' : '<div class="hero-chip" style="background:rgba(255,255,255,.14)">' + esc(emp.location) + '</div>') +
        '<div class="hero-info"><div class="hero-name">' + esc(emp.name) + '</div><div class="hero-role">' + esc(emp.designation) + '</div>' +
          (emp._co ? '<div class="hero-company">' + coTile(emp._co) + '<span class="co-cname">' + esc(tcase(emp._co.name)) + '</span></div>' : '') +
        '</div>' +
      '</div>';

    var bars = '';
    for (var d = 0; d < 7; d++) {
      var pct = Math.round((a.week[d] / 360) * 100);
      var isPeak = d === a.peak;
      bars += '<div class="bar-col' + (isPeak ? ' has-tip' : '') + '">' +
        (isPeak ? '<div class="bar-tip">' + (a.peakVal / 60).toFixed(1) + ' hour</div>' : '') +
        '<div class="bar' + (isPeak ? ' peak' : '') + '" data-h="' + Math.max(4, pct) + '"></div>' +
        '<div class="bar-dot"></div><div class="bar-lbl">' + days[d] + '</div></div>';
    }
    html += widget('col-3', i++,
      '<div class="wt-total" data-count="' + a.totalH.toFixed(1) + '">0.0 <small>Total Work Time</small></div>' +
      '<div class="bars">' + bars + '</div>', 'Progress', '');

    var C = 2 * Math.PI * 70;
    html += widget('col-3', i++,
      '<div class="ring-wrap">' +
        '<div class="ring"><svg width="170" height="170">' +
          '<circle cx="85" cy="85" r="70" fill="none" stroke="var(--bg-tertiary)" stroke-width="12"/>' +
          '<circle id="ringArc" cx="85" cy="85" r="70" fill="none" stroke="var(--primary)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" data-off="' + (C * (1 - a.ring.pct)) + '"/>' +
        '</svg>' +
        '<div class="ring-center"><div class="ring-time">' + fmtMin(a.ring.min) + '</div><div class="ring-lbl">Work Time</div></div></div>' +
        '<div class="ring-ctrls"><button class="ring-btn primary" id="ringPlay"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg></button>' +
        '<button class="ring-btn" id="ringPause"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></button>' +
        '<button class="ring-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></button></div>' +
      '</div>', 'Progress', '');

    var todo = 100 - a.onboarding, prog = Math.min(a.onboarding, Math.round(a.onboarding * 0.6));
    html += widget('col-3', i++,
      '<div class="ob-head"><span></span><span class="ob-pct" data-count="' + a.onboarding + '" data-suffix="%">0%</span></div>' +
      '<div class="ob-seg">' +
        '<div class="ob-block" data-basis="' + Math.max(a.onboarding, 8) + '" style="background:var(--primary)">' + (a.onboarding > 12 ? 'Done' : '') + '</div>' +
        '<div class="ob-block" data-basis="' + Math.max(prog, 6) + '" style="background:var(--gray-800)"></div>' +
        '<div class="ob-block" data-basis="' + Math.max(todo, 6) + '" style="background:var(--bg-tertiary);color:var(--text-tertiary)"></div>' +
      '</div>' +
      '<div class="ob-legend"><span class="ob-leg"><i style="background:var(--primary)"></i>Completed</span><span class="ob-leg"><i style="background:var(--gray-800)"></i>In progress</span><span class="ob-leg"><i style="background:var(--bg-tertiary)"></i>To do</span></div>',
      'Onboarding', '');

    /* Row 3: schedule, details, top performers */
    html += widget('col-5', i++, scheduleHTML(emp), 'This Week', '02 – 06 March');
    html += widget('col-4', i++, detailsHTML(emp, a), 'Details', '');
    html += widget('col-3', i++, tasksHTML(emp), 'Tasks', '');

    grid.innerHTML = html;
    document.getElementById('dashLoading').style.display = 'none';
    grid.style.display = 'grid';

    animate(a);
    wireInteractions();
  }

  function widget(cls, i, body, title, sub) {
    return '<div class="w ' + cls + '" style="--i:' + i + '">' +
      (title ? '<div class="w-title">' + esc(title) + (sub ? '<span class="w-sub">' + esc(sub) + '</span>' : '<button class="expand-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></button>') + '</div>' : '') +
      '<div style="margin-top:' + (title ? '14px' : '0') + '">' + body + '</div></div>';
  }
  function tile(key, val, label, ico) {
    return '<div class="stat-tile"><div class="stat-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ico + '</svg></div>' +
      '<div><div class="stat-val" data-count="' + val + '">0</div><div class="stat-lbl">' + label + '</div></div></div>';
  }
  function tileText(key, val, label, ico) {
    return '<div class="stat-tile"><div class="stat-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ico + '</svg></div>' +
      '<div><div class="stat-val">' + val + '</div><div class="stat-lbl">' + label + '</div></div></div>';
  }
  function kpi(name, pct, color) {
    return '<div class="kpi"><div class="kpi-top"><span class="kpi-name">' + name + '</span><span class="kpi-pct">' + pct + '%</span></div>' +
      '<div class="kpi-track"><div class="kpi-fill" data-w="' + pct + '" style="background:' + color + '"></div></div></div>';
  }

  function scheduleHTML(emp) {
    var head = '<div class="sched-dayhead"></div>';
    var dows = [['Mon', '02'], ['Tue', '03'], ['Wed', '04'], ['Thu', '05'], ['Fri', '06']];
    dows.forEach(function (d) { head += '<div class="sched-dayhead"><div class="sched-dow">' + d[0] + '</div><div class="sched-date">' + d[1] + '</div></div>'; });
    var hours = ['09:00', '10:00', '11:00', '12:00', '13:00'];
    var rows = '';
    hours.forEach(function (hr, r) {
      rows += '<div class="sched-hour">' + hr + '</div>';
      for (var c = 0; c < 5; c++) {
        var ev = '';
        if (r === 1 && c === 0) ev = '<div class="ev soft" style="top:4px;height:66px"><div class="ev-title">Weekly Team Sync</div><div class="ev-sub">Discuss ongoing projects</div></div>';
        if (r === 3 && c === 1) ev = '<div class="ev dark" style="top:4px;height:60px"><div class="ev-title">Onboarding Session</div><div class="ev-sub">Intro for new hires · 10:44</div></div>';
        if (r === 1 && c === 4) ev = '<div class="ev blue" style="top:4px;height:150px"><div class="ev-title">Webinar</div><div class="ev-sub">Zoom · Mon–Thu</div></div>';
        rows += '<div class="sched-cell">' + ev + '</div>';
      }
    });
    return '<div class="sched">' + head + rows + '</div>';
  }

  function detailsHTML(emp, a) {
    var co = emp._co || companyFor(emp);
    var items = [];
    if (co) {
      items.push(['Company',
        '<div class="co-detail">' + coTile(co, 'cd') + '<div><div class="co-name2">' + esc(tcase(co.name)) + '</div><div class="co-sector2">' + esc(co.sector) + '</div></div></div>' +
        '<div class="kv"><span>Sector</span><b>' + esc(co.sector) + '</b></div>' +
        (co.holding ? '<div class="kv"><span>Holding company</span><b>' + esc(tcase(co.holding)) + '</b></div>' : '') +
        '<div class="kv"><span>Employee code</span><b>' + esc(emp.emp_code || '—') + '</b></div>' +
        (co.website ? '<div class="kv"><span>Website</span><b><a href="' + esc(co.website) + '" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none">Visit ↗</a></b></div>' : '')
      ]);
    }
    items.push(
      ['Pension Contribution', '<div class="kv"><span>Employer</span><b>6.0%</b></div><div class="kv"><span>Employee</span><b>4.0%</b></div><div class="kv"><span>Vested</span><b>' + Math.min(100, a.tenure.years * 20) + '%</b></div>'],
      ['Devices', '<div class="device-row"><div class="device-ic">💻</div><div><div style="font-weight:600;font-size:13px;color:var(--text-primary)">' + esc(a.device) + '</div><div style="font-size:11px;color:var(--text-tertiary)">Assigned · ' + esc(emp.emp_code) + '</div></div></div>'],
      ['Compensation Summary', '<div class="kv"><span>Band</span><b>' + a.salaryBand + '</b></div><div class="kv"><span>Review cycle</span><b>Annual</b></div><div class="kv"><span>Last revised</span><b>Jan 2026</b></div>'],
      ['Employee Benefits', '<div class="kv"><span>Health cover</span><b>Family</b></div><div class="kv"><span>Annual leave</span><b>' + a.leave + ' days</b></div><div class="kv"><span>Learning budget</span><b>Active</b></div>']
    );
    return items.map(function (it, idx) {
      return '<div class="acc-item' + (idx === 0 ? ' open' : '') + '">' +
        '<div class="acc-head" data-acc>' + esc(it[0]) + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>' +
        '<div class="acc-body"><div class="acc-inner">' + it[1] + '</div></div></div>';
    }).join('');
  }

  // Deterministic per-employee task list — stable per person, like the rest of
  // the derived analytics.
  function empTasks(emp) {
    var pool = [
      'Finalize quarterly report', 'Review onboarding checklist', 'Update project roadmap',
      'Prepare sprint demo', 'Approve pending leave requests', 'Sync with design team',
      'Draft policy revision', 'Resolve support tickets', 'Plan team retrospective',
      'Audit access permissions', 'Submit expense report', 'Refine hiring pipeline'
    ];
    var ago = ['just now', '2h ago', '5h ago', 'Yesterday', '2d ago', '3d ago'];
    var base = hash(strHash(emp.id + 'tasks'));
    var out = [];
    for (var k = 0; k < 6; k++) {
      var v = hash(base + k * 0x9E3779B1);
      var s = v % 100;
      var status = s < 34 ? 'done' : s < 72 ? 'in_progress' : 'todo';
      out.push({
        id: 't' + k,
        title: pool[(v + k) % pool.length],
        status: status,
        updated: ago[(v >>> 7) % ago.length],
        priority: ['High', 'Normal', 'Low'][(v >>> 9) % 3]
      });
    }
    return out;
  }

  function taskPill(status) {
    if (status === 'done') return '<span class="task-pill done">Done</span>';
    if (status === 'in_progress') return '<span class="task-pill prog">In progress</span>';
    return '<span class="task-pill todo">To do</span>';
  }

  function tasksHTML(emp) {
    var ts = empTasks(emp);
    var done = ts.filter(function (t) { return t.status === 'done'; }).length;
    var pct = Math.round(done / ts.length * 100);
    var head = '<div class="task-sum">' +
      '<div class="task-sum-top"><span class="task-sum-k">' + done + ' of ' + ts.length + ' done</span>' +
      '<span class="task-sum-pct">' + pct + '%</span></div>' +
      '<div class="task-bar"><div class="task-bar-fill" data-w="' + pct + '"></div></div></div>';
    var list = '<div class="task-list">' + ts.map(function (t, j) {
      return '<div class="task-item' + (t.status === 'done' ? ' is-done' : '') + '" data-tid="' + t.id + '" style="--j:' + j + '">' +
        '<button class="task-check" data-check aria-label="Toggle task"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>' +
        '<div class="task-main"><div class="task-title">' + esc(t.title) + '</div>' +
        '<div class="task-meta">' + taskPill(t.status) + '<span class="task-upd">Updated ' + t.updated + '</span></div></div>' +
        '</div>';
    }).join('') + '</div>';
    return head + list;
  }

  function updateTaskSummary() {
    var items = document.querySelectorAll('.task-item');
    var done = document.querySelectorAll('.task-item.is-done').length;
    var pct = items.length ? Math.round(done / items.length * 100) : 0;
    var fill = document.querySelector('.task-bar-fill'); if (fill) fill.style.width = pct + '%';
    var pctEl = document.querySelector('.task-sum-pct'); if (pctEl) pctEl.textContent = pct + '%';
    var kEl = document.querySelector('.task-sum-k'); if (kEl) kEl.textContent = done + ' of ' + items.length + ' done';
  }

  /* ---------- animation ---------- */
  function animate(a) {
    // bars
    setTimeout(function () {
      document.querySelectorAll('.bar').forEach(function (b) { b.style.height = b.getAttribute('data-h') + '%'; });
      document.querySelectorAll('.kpi-fill').forEach(function (f) { f.style.width = f.getAttribute('data-w') + '%'; });
      document.querySelectorAll('.ob-block').forEach(function (o) { o.style.flexBasis = o.getAttribute('data-basis') + '%'; });
      document.querySelectorAll('.task-bar-fill').forEach(function (f) { f.style.width = f.getAttribute('data-w') + '%'; });
      var arc = document.getElementById('ringArc');
      if (arc) arc.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)', arc.style.strokeDashoffset = arc.getAttribute('data-off');
    }, reduce ? 0 : 80);
    // count-ups
    document.querySelectorAll('[data-count]').forEach(function (el) {
      countUp(el, parseFloat(el.getAttribute('data-count')), el.getAttribute('data-suffix') || '', String(el.getAttribute('data-count')).indexOf('.') >= 0);
    });
  }

  function wireInteractions() {
    document.querySelectorAll('[data-acc]').forEach(function (h) {
      h.addEventListener('click', function () { this.parentElement.classList.toggle('open'); });
    });
    var play = document.getElementById('ringPlay'), pause = document.getElementById('ringPause');
    if (play) play.addEventListener('click', function () { play.classList.add('primary'); pause.classList.remove('primary'); toast('Timer running', 'success'); });
    if (pause) pause.addEventListener('click', function () { pause.classList.add('primary'); play.classList.remove('primary'); toast('Timer paused', 'info'); });
    var msg = document.getElementById('msgBtn'), edit = document.getElementById('editBtn');
    if (msg) msg.addEventListener('click', function () { toast('Opening chat…', 'success'); });
    if (edit) edit.addEventListener('click', function () { toast('Edit profile — coming soon', 'info'); });

    // Task checkboxes: toggle done, update status pill + completion bar.
    document.querySelectorAll('.task-item [data-check]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = btn.closest('.task-item');
        var isDone = item.classList.toggle('is-done');
        var pill = item.querySelector('.task-pill');
        if (pill) { pill.className = 'task-pill ' + (isDone ? 'done' : 'todo'); pill.textContent = isDone ? 'Done' : 'To do'; }
        var upd = item.querySelector('.task-upd'); if (upd) upd.textContent = 'Updated just now';
        updateTaskSummary();
        toast(isDone ? 'Task marked done' : 'Task reopened', isDone ? 'success' : 'info');
      });
    });
  }

  /* ---------- company (from the hierarchy data) ---------- */
  var _companies = null;
  function companies() {
    if (_companies) return _companies;
    _companies = [];
    try {
      if (typeof SECTORS_DATA !== 'undefined') {
        SECTORS_DATA.forEach(function (sec) {
          (sec.companies || []).forEach(function (c) {
            if (c && c.name) _companies.push({ name: c.name, logo: c.logo || '', sector: sec.name, holding: sec.holding || '', website: c.website || '' });
          });
        });
      }
    } catch (e) {}
    return _companies;
  }
  function companyFor(emp) {
    var list = companies(); if (!list.length) return null;
    var x = hash(strHash((emp.id || emp.name || '') + 'co'));
    return list[x % list.length];
  }
  function tcase(s) {
    return String(s || '').split(/\s+/).map(function (w) {
      if (/^[A-Z0-9&().\/\-]{1,4}$/.test(w)) return w;               // keep short acronyms as-is
      return w.replace(/^([^A-Za-z]*)([A-Za-z])(.*)$/, function (_, pre, c, rest) { return pre + c.toUpperCase() + rest.toLowerCase(); });
    }).join(' ');
  }
  function coInitials(name) {
    var w = String(name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
    return (((w[0] || '?')[0] || '') + ((w[1] || '')[0] || '')).toUpperCase();
  }
  function coTile(co, cls) {
    return '<span class="co-tile ' + (cls || '') + '">' +
      '<span class="co-fb">' + esc(coInitials(co.name)) + '</span>' +
      (co.logo ? '<img src="' + esc(co.logo) + '" alt="" onload="this.previousElementSibling.style.display=\'none\'" onerror="this.remove()">' : '') +
      '</span>';
  }

  /* ---------- helpers ---------- */
  function avatarStyle(e) {
    var h = e.hue != null ? e.hue : 220;
    return 'background:linear-gradient(140deg, hsl(' + h + ',66%,55%), hsl(' + ((h + 45) % 360) + ',60%,42%))';
  }
  function photoURL(e) {
    var s = String(e.email || e.id || e.name || ''), x = 0;
    for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    var g = (x % 2) ? 'women' : 'men';
    if (window.lcPhoto) return window.lcPhoto(s, g, 480);
    return 'https://randomuser.me/api/portraits/' + g + '/' + (x % 100) + '.jpg';
  }
  function fmtMin(m) { var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  function tenure(joining) {
    var mo = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    var p = String(joining).split('-'); var jd = new Date(parseInt(p[2], 10), mo[p[1]] || 0, parseInt(p[0], 10) || 1);
    var now = new Date(); var months = (now.getFullYear() - jd.getFullYear()) * 12 + (now.getMonth() - jd.getMonth());
    if (months < 0) months = 0;
    return { years: Math.floor(months / 12), months: months % 12, totalMonths: months };
  }
  function countUp(el, target, suffix, isFloat) {
    if (reduce) { el.textContent = (isFloat ? target.toFixed(1) : Math.round(target)) + suffix; return; }
    var t0 = performance.now(), dur = 750;
    function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (isFloat ? (target * e).toFixed(1) : Math.round(target * e)) + suffix;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function toast(msg, kind) {
    var c = document.getElementById('toastContainer'); if (!c) return;
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'background:var(--surface-raised);border:1px solid var(--border);color:var(--text-primary);padding:12px 16px;border-radius:12px;box-shadow:var(--shadow-lg);margin-top:8px;font-size:13px;font-weight:500;animation:wIn .3s ease both';
    c.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 300); }, 2400);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function strHash(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; }
  function hash(x) { x = (x ^ (x >>> 16)) >>> 0; x = Math.imul(x, 2246822519) >>> 0; x = (x ^ (x >>> 13)) >>> 0; x = Math.imul(x, 3266489917) >>> 0; return (x ^ (x >>> 16)) >>> 0; }

  /* ---------- offline roster (mirrors js/directory.js) ---------- */
  function genRoster(n) {
    var first = ['Toni','Wade','Leslie','Robert','Jacob','Jane','Esther','Jerome','Kathryn','Courtney','Devon','Priya','Ahmed','Fatima','Noor','David','Aisha','Michael','Lisa','James','Sofia','Omar','Hana','Ravi','Mei','Carlos','Zara','Ibrahim','Elena','Kofi','Yuki','Amara','Dilan','Nadia','Sanjay','Leah','Marcus','Tara','Yusuf','Ingrid'];
    var last = ['Kross','Warren','Alexander','Fox','Jones','Cooper','Howard','Bell','Murphy','Henry','Lane','Sharma','Al-Rashid','Al-Hassan','Abdullah','Lee','Mohamed','Chen','Thompson','Wilson','Rossi','Khalid','Silva','Patel','Tanaka','Mendez','Okafor','Nguyen','Costa','Mensah'];
    var roles = [['Product Designer','Design','Product','Designer',true],['UX/UI Designer','Design','Product','Designer',false],['Graphic Designer','Design','Brand','Designer',false],['Web Designer','Design','Web','Designer',false],['iOS Developer','Engineering','Mobile','Developer',false],['Frontend Developer','Engineering','Web','Developer',false],['Backend Developer','Engineering','Platform','Developer',false],['DevOps Engineer','Engineering','Infrastructure','Developer',true],['Engineering Manager','Engineering','Platform','Developer',true],['HR Officer','Human Resources','People Ops','HR',false],['HR Business Partner','Human Resources','People Ops','HR',true],['Finance Officer','Finance','Accounting','Finance',false],['Finance Director','Finance','Accounting','Finance',true],['Marketing Manager','Marketing','Growth','Marketing',true],['Content Strategist','Marketing','Growth','Marketing',false],['Operations Lead','Operations','Delivery','Operations',true],['IT Support Analyst','Information Technology','Support','IT',false],['Network Engineer','Information Technology','Infrastructure','IT',false],['QA Engineer','Engineering','Quality','Developer',false],['Data Analyst','Operations','Analytics','Analyst',false]];
    var locs = ['HQ — Main Building','HQ — Block A, Floor 2','Campus A','Campus B','Remote'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var out = [];
    for (var i = 0; i < n; i++) {
      var v = hash(i + 1);
      var fn = first[v % first.length], ln = last[(v >>> 5) % last.length], r = roles[(v >>> 10) % roles.length], loc = locs[(v >>> 15) % locs.length];
      var senior = r[4], cat = senior ? 'Management' : 'Non-Management';
      var day = 1 + (v % 28), mon = months[(v >>> 3) % 12], yr = 2020 + ((v >>> 7) % 5);
      out.push({ id: 'emp_' + pad(i + 1), name: fn + ' ' + ln, designation: r[0], department: r[1], function: r[2], category: cat, tags: [r[3], cat], emp_code: 'EMP-' + yr + '-' + (1000 + (i * 7 % 9000)), joining_date: (day < 10 ? '0' + day : day) + '-' + mon + '-' + yr, email: (fn + '.' + ln.replace(/-/g, '')).toLowerCase() + '@lyceum.edu', phone: '+968 24', location: loc, reports_to: senior ? 'Office of the CEO' : 'Department Head', initials: (fn[0] + ln[0]).toUpperCase(), hue: v % 360, online: v % 3 === 0 });
    }
    return out;
  }
  function pad(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n; }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
