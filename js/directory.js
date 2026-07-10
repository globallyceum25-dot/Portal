/* ============================================================
   LYCEUM CONNECT — Employee Directory (Phase 5+)
   Modern card grid with staggered entrance, pointer-tracked
   spotlight hover, skeleton loading, animated count-up, chip
   filters, debounced search, grid/list views, windowed
   pagination and a spring slide-in detail drawer.

   Data comes from the Go backend (GET /api/directory —
   server-side search/filter/paginate). When the backend is
   unreachable it falls back to an identical-shaped roster
   generated in the browser, so the page always works offline.
   ============================================================ */
(function () {
  'use strict';

  var PAGE_SIZE = 12;
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = { q: '', dept: '', tag: '', page: 1, view: 'grid', grand: 0 };
  var useApi = false;
  var roster = null;      // full fallback roster (offline)
  var lastResult = null;
  var searchTimer = null;

  /* ---------- boot ---------- */
  async function init() {
    wire();
    try { useApi = !!(window.LC && LC.token() && await LC.health()); } catch (e) { useApi = false; }

    // Prefer the live Supabase directory when the user has a real session.
    var usedSupabase = false;
    try {
      if (window.LCData) {
        var d = await window.LCData.employees();
        if (d.source === 'supabase' && d.rows.length) {
          roster = d.rows.map(normalizeEmp);
          useApi = false;            // search/paging run client-side over the live roster
          usedSupabase = true;
        }
      }
    } catch (e) { /* fall back to backend/local */ }

    if (!usedSupabase && !useApi) roster = generateRoster(140);
    await load(true);
  }

  // Shape a Supabase employees row like the local roster (derive initials, defaults).
  function normalizeEmp(e) {
    var parts = String(e.name || '').trim().split(/\s+/);
    var derived = ((parts[0] || '')[0] || '') + ((parts[parts.length - 1] || '')[0] || '');
    return {
      id: e.id, name: e.name, designation: e.designation, department: e.department,
      function: e.function, category: e.category, tags: e.tags || [],
      emp_code: e.emp_code, joining_date: e.joining_date, email: e.email, phone: e.phone,
      location: e.location, reports_to: e.reports_to,
      initials: (e.initials || derived || '?').toUpperCase(),
      hue: e.hue != null ? e.hue : 220, online: !!e.online
    };
  }

  // Admin-only: create an employee in Supabase, then refresh the live roster.
  async function onAddEmployee() {
    var admin = false;
    try { admin = !!(window.LCData && await window.LCData.isAdmin()); } catch (e) { }
    if (!admin) { toast('Admins only — sign in with an admin account to add employees', 'error'); return; }

    var name = prompt('Full name:'); if (!name) return;
    var designation = prompt('Designation:', 'Officer') || '';
    var department = prompt('Department:', 'Operations') || '';
    var email = prompt('Work email:', name.trim().toLowerCase().replace(/\s+/g, '.') + '@lyceum.edu') || '';
    var senior = /manager|director|lead|head|chief|officer of|vp|president/i.test(designation);
    var category = senior ? 'Management' : 'Non-Management';
    var row = {
      id: 'emp_' + Date.now(), name: name.trim(), designation: designation, department: department,
      category: category, email: email, emp_code: 'EMP-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      joining_date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      location: 'HQ — Main Building', reports_to: 'Department Head',
      tags: [category], hue: Math.floor(Math.random() * 360), online: false
    };
    try {
      var res = await window.LCData.createEmployee(row);
      if (res.error) throw new Error(res.error.message);
      toast('Employee added — ' + row.name, 'success');
      var d = await window.LCData.employees();
      if (d.source === 'supabase') { roster = d.rows.map(normalizeEmp); state.page = 1; load(); }
    } catch (e) { toast('Add failed: ' + (e.message || e), 'error'); }
  }

  function wire() {
    var search = $('dirSearch');
    search.addEventListener('input', function () {
      $('dirSearchWrap').classList.toggle('has-text', !!search.value);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.q = search.value.trim(); state.page = 1; load(); }, 260);
    });
    $('dirSearchClear').addEventListener('click', function () {
      search.value = ''; state.q = ''; state.page = 1;
      $('dirSearchWrap').classList.remove('has-text'); load(); search.focus();
    });

    $('filterBtn').addEventListener('click', function () {
      var open = $('filtersPanel').classList.toggle('open');
      this.classList.toggle('active', open);
    });

    // Category / role chips inside the filters panel
    $('filtersPanel').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip'); if (!chip) return;
      state.tag = chip.getAttribute('data-tag') || '';
      state.page = 1;
      syncTagChips();
      $('filterBtn').classList.toggle('has-filters', !!(state.tag || state.dept));
      load();
    });

    // Department chips
    $('deptChips').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip'); if (!chip) return;
      state.dept = chip.getAttribute('data-dept') || '';
      state.page = 1;
      $('filterBtn').classList.toggle('has-filters', !!(state.tag || state.dept));
      load();
    });

    $('gridViewBtn').addEventListener('click', function () { setView('grid'); });
    $('listViewBtn').addEventListener('click', function () { setView('list'); });

    // Card / row click → drawer (event delegation)
    $('empGrid').addEventListener('click', onEmpClick);
    $('empList').addEventListener('click', onEmpClick);

    // Drawer close
    $('drawerClose').addEventListener('click', closeDrawer);
    $('drawerOverlay').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    // Header actions
    $('addBtn').addEventListener('click', onAddEmployee);
    $('importBtn').addEventListener('click', function () { toast('Import flow — connect your HRIS to sync', 'info'); });
  }

  function syncTagChips() {
    Array.prototype.forEach.call($('filtersPanel').querySelectorAll('.chip'), function (c) {
      c.classList.toggle('active', (c.getAttribute('data-tag') || '') === state.tag);
    });
  }

  function setView(v) {
    if (state.view === v) return;
    state.view = v;
    $('gridViewBtn').classList.toggle('active', v === 'grid');
    $('listViewBtn').classList.toggle('active', v === 'list');
    render(lastResult);
  }

  /* ---------- data ---------- */
  async function load(initial) {
    showSkeleton();
    var res;
    try {
      res = useApi ? await fetchApi() : queryLocal();
    } catch (e) {
      // API failed mid-session → degrade to local roster.
      if (!roster) roster = generateRoster(140);
      useApi = false;
      res = queryLocal();
    }
    lastResult = res;
    if (initial || state.grand !== res.grand_total) {
      countUp($('empCount'), res.grand_total);
      state.grand = res.grand_total;
    }
    renderDeptChips(res.departments);
    render(res);
  }

  function fetchApi() {
    var qs = new URLSearchParams({ q: state.q, dept: state.dept, tag: state.tag, page: state.page, page_size: PAGE_SIZE });
    return LC.get('/api/directory?' + qs.toString());
  }

  function queryLocal() {
    var term = state.q.toLowerCase();
    var searched = roster.filter(function (e) {
      if (term && (e.name + ' ' + e.designation + ' ' + e.department + ' ' + e.emp_code + ' ' + e.email).toLowerCase().indexOf(term) === -1) return false;
      if (state.tag && e.tags.indexOf(state.tag) === -1) return false;
      return true;
    });
    var deptCount = {};
    searched.forEach(function (e) { deptCount[e.department] = (deptCount[e.department] || 0) + 1; });
    var matched = searched.filter(function (e) { return !state.dept || e.department === state.dept; });
    var total = matched.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    var start = (state.page - 1) * PAGE_SIZE;
    var facets = Object.keys(deptCount).map(function (k) { return { label: k, count: deptCount[k] }; })
      .sort(function (a, b) { return b.count - a.count || a.label.localeCompare(b.label); });
    return {
      employees: matched.slice(start, start + PAGE_SIZE),
      total: total, grand_total: roster.length, page: state.page, page_size: PAGE_SIZE, pages: pages, departments: facets
    };
  }

  /* ---------- render ---------- */
  function showSkeleton() {
    if (state.view === 'list') { return; }
    var grid = $('empGrid');
    grid.style.display = 'grid';
    $('empList').style.display = 'none';
    $('empEmpty').style.display = 'none';
    $('dirPager').style.display = 'none';
    var cards = '';
    for (var i = 0; i < PAGE_SIZE; i++) {
      cards += '<div class="skel-card">' +
        '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
        '<div class="skel" style="width:46px;height:46px;border-radius:14px"></div>' +
        '<div style="flex:1"><div class="skel" style="height:12px;width:70%;margin-bottom:7px"></div><div class="skel" style="height:10px;width:45%"></div></div></div>' +
        '<div class="skel" style="height:20px;width:60%;margin-bottom:14px;border-radius:999px"></div>' +
        '<div class="skel" style="height:11px;width:80%;margin-bottom:7px"></div>' +
        '<div class="skel" style="height:11px;width:65%"></div></div>';
    }
    grid.innerHTML = cards;
  }

  function render(res) {
    if (!res) return;
    var empty = res.employees.length === 0;
    $('empEmpty').style.display = empty ? 'block' : 'none';
    $('empGrid').style.display = (!empty && state.view === 'grid') ? 'grid' : 'none';
    $('empList').style.display = (!empty && state.view === 'list') ? 'block' : 'none';

    if (!empty) {
      if (state.view === 'grid') $('empGrid').innerHTML = res.employees.map(cardHTML).join('');
      else $('empList').innerHTML = res.employees.map(rowHTML).join('');
    }
    renderPager(res);
  }

  function avatarStyle(e) {
    var h = e.hue != null ? e.hue : 220;
    return 'background:linear-gradient(140deg, hsl(' + h + ',68%,58%), hsl(' + ((h + 40) % 360) + ',66%,46%))';
  }
  // Sample photo per employee (stable). Uses randomuser.me's static portrait CDN
  // (fast + cacheable, unlike a dynamic per-request service), picking a gender +
  // index deterministically from the employee. Falls back to the gradient +
  // initials if the image can't load (offline), so nothing ever breaks.
  function pfrag(e) {
    var s = String(e.email || e.id || e.name || ''), x = 0;
    for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    return { g: (x % 2) ? 'women' : 'men', n: x % 100 };
  }
  function photoURL(e) { var p = pfrag(e); if (window.lcPhoto) return window.lcPhoto(String(e.email || e.id || e.name || ''), p.g, 200); return 'https://randomuser.me/api/portraits/med/' + p.g + '/' + p.n + '.jpg'; }
  function photoImg(e) { return '<img class="av-photo" src="' + photoURL(e) + '" alt="" onerror="this.remove()">'; }

  function tagClass(t) {
    if (t === 'Management') return 'mgmt';
    if (t === 'Non-Management') return 'nonmgmt';
    return 'role';
  }

  function cardHTML(e, i) {
    var tags = e.tags.map(function (t) { return '<span class="emp-tag ' + tagClass(t) + '">' + esc(t) + '</span>'; }).join('');
    var online = e.online ? '<span class="emp-online"></span>' : '';
    return '' +
      '<div class="emp-card" data-id="' + e.id + '" style="--i:' + i + '">' +
        '<div class="emp-top">' +
          '<div class="emp-avatar" style="' + avatarStyle(e) + '"><span class="ring"></span>' + esc(e.initials) + photoImg(e) + online + '</div>' +
          '<div class="emp-idcol"><div class="emp-name">' + esc(e.name) + '</div><div class="emp-role">' + esc(e.designation) + '</div></div>' +
          '<div class="emp-menu" data-menu="1">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>' +
          '</div>' +
        '</div>' +
        '<div class="emp-tags">' + tags + '</div>' +
        '<div class="emp-meta">' +
          '<div class="emp-meta-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg> Emp Code: <b>' + esc(e.emp_code) + '</b></div>' +
          '<div class="emp-meta-row"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Joining Date: <b>' + esc(e.joining_date) + '</b></div>' +
        '</div>' +
      '</div>';
  }

  function rowHTML(e, i) {
    return '' +
      '<div class="emp-row" data-id="' + e.id + '" style="--i:' + i + '">' +
        '<div class="who"><div class="emp-avatar" style="' + avatarStyle(e) + '">' + esc(e.initials) + photoImg(e) + '</div>' +
          '<div><div class="rn">' + esc(e.name) + '</div><div class="rr">' + esc(e.designation) + '</div></div></div>' +
        '<div class="col-hide">' + esc(e.department) + '</div>' +
        '<div class="col-hide">' + esc(e.emp_code) + '</div>' +
        '<div class="col-hide" style="text-align:right">' + esc(e.joining_date) + '</div>' +
      '</div>';
  }

  function renderDeptChips(facets) {
    var total = facets.reduce(function (a, f) { return a + f.count; }, 0);
    var html = '<button class="chip' + (state.dept === '' ? ' active' : '') + '" data-dept="">All <span class="chip-count">' + total + '</span></button>';
    html += facets.map(function (f) {
      return '<button class="chip' + (state.dept === f.label ? ' active' : '') + '" data-dept="' + esc(f.label) + '">' +
        esc(f.label) + ' <span class="chip-count">' + f.count + '</span></button>';
    }).join('');
    $('deptChips').innerHTML = html;
  }

  function renderPager(res) {
    var pager = $('dirPager');
    if (res.total === 0) { pager.style.display = 'none'; return; }
    pager.style.display = 'flex';
    var from = (res.page - 1) * res.page_size + 1;
    var to = Math.min(res.page * res.page_size, res.total);
    $('pagerInfo').textContent = 'Showing ' + from + '–' + to + ' of ' + res.total + ' employees';

    var btns = '';
    btns += pbtn('‹ Previous', res.page - 1, res.page <= 1, false, 'prev');
    windowPages(res.page, res.pages).forEach(function (p) {
      if (p === '…') btns += '<span class="page-ellipsis">…</span>';
      else btns += pbtn(String(p), p, false, p === res.page, 'num');
    });
    btns += pbtn('Next ›', res.page + 1, res.page >= res.pages, false, 'next');
    $('pagerBtns').innerHTML = btns;
    Array.prototype.forEach.call($('pagerBtns').querySelectorAll('.page-btn'), function (b) {
      b.addEventListener('click', function () {
        var p = parseInt(b.getAttribute('data-p'), 10);
        if (!isNaN(p) && p !== state.page) { state.page = p; load(); scrollTop(); }
      });
    });
  }

  function pbtn(label, p, disabled, active, kind) {
    return '<button class="page-btn' + (active ? ' active' : '') + '" data-p="' + p + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  }

  function windowPages(cur, total) {
    var out = [];
    if (total <= 7) { for (var i = 1; i <= total; i++) out.push(i); return out; }
    out.push(1);
    var start = Math.max(2, cur - 1), end = Math.min(total - 1, cur + 1);
    if (start > 2) out.push('…');
    for (var j = start; j <= end; j++) out.push(j);
    if (end < total - 1) out.push('…');
    out.push(total);
    return out;
  }

  function scrollTop() {
    var m = document.querySelector('.page-content');
    if (m) m.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- interactions ---------- */
  function onEmpClick(e) {
    var el = e.target.closest('[data-id]'); if (!el) return;
    var id = el.getAttribute('data-id');
    // The "⋯" menu opens the quick-peek drawer; clicking the card opens the
    // full per-employee dashboard.
    if (e.target.closest('[data-menu]')) {
      var emp = (lastResult.employees || []).find(function (x) { return x.id === id; });
      if (emp) openDrawer(emp);
      return;
    }
    location.href = 'employee.html?id=' + encodeURIComponent(id);
  }

  function openDrawer(e) {
    $('dwAvatar').innerHTML = esc(e.initials) + photoImg(e);
    $('dwAvatar').setAttribute('style', avatarStyle(e));
    $('dwName').textContent = e.name;
    $('dwRole').textContent = e.designation;
    $('dwBadges').innerHTML = e.tags.map(function (t) { return '<span class="emp-tag ' + tagClass(t) + '">' + esc(t) + '</span>'; }).join('');
    var fields = [
      ['Employee ID', e.emp_code], ['Joining Date', e.joining_date],
      ['Department', e.department], ['Function', e.function],
      ['Category', e.category], ['Location', e.location],
      ['Reports To', e.reports_to], ['Status', e.online ? 'Online now' : 'Offline'],
      ['Email', e.email, true], ['Phone', e.phone, true]
    ];
    $('dwFields').innerHTML = fields.map(function (f) {
      return '<div' + (f[2] ? ' class="df-full"' : '') + '><div class="df-label">' + esc(f[0]) + '</div><div class="df-value">' + esc(f[1] || '—') + '</div></div>';
    }).join('');
    $('dwEmail').setAttribute('href', 'mailto:' + (e.email || ''));
    $('dwChat').onclick = function () { toast('Opening chat with ' + e.name.split(' ')[0] + '…', 'success'); };

    $('drawerOverlay').classList.add('open');
    $('empDrawer').classList.add('open');
    $('empDrawer').setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    $('drawerOverlay').classList.remove('open');
    $('empDrawer').classList.remove('open');
    $('empDrawer').setAttribute('aria-hidden', 'true');
  }

  /* ---------- pointer-tracked spotlight ---------- */
  if (!reduceMotion) {
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.emp-card');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- count-up ---------- */
  function countUp(el, target) {
    if (reduceMotion) { el.textContent = target; return; }
    var start = parseInt(el.textContent, 10) || 0;
    var t0 = performance.now(), dur = 700;
    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var val = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3)));
      el.textContent = val;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- toast (uses portal container) ---------- */
  function toast(msg, kind) {
    var c = $('toastContainer'); if (!c) { console.log(msg); return; }
    var t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'info');
    t.textContent = msg;
    t.style.cssText = 'background:var(--surface-raised);border:1px solid var(--border);color:var(--text-primary);padding:12px 16px;border-radius:12px;box-shadow:var(--shadow-lg);margin-top:8px;font-size:13px;font-weight:500;animation:empIn .3s ease both';
    c.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 300); }, 2600);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------- offline roster generator (mirrors the Go seed) ---------- */
  function generateRoster(n) {
    var first = ['Toni','Wade','Leslie','Robert','Jacob','Jane','Esther','Jerome','Kathryn','Courtney','Devon','Priya','Ahmed','Fatima','Noor','David','Aisha','Michael','Lisa','James','Sofia','Omar','Hana','Ravi','Mei','Carlos','Zara','Ibrahim','Elena','Kofi','Yuki','Amara','Dilan','Nadia','Sanjay','Leah','Marcus','Tara','Yusuf','Ingrid'];
    var last = ['Kross','Warren','Alexander','Fox','Jones','Cooper','Howard','Bell','Murphy','Henry','Lane','Sharma','Al-Rashid','Al-Hassan','Abdullah','Lee','Mohamed','Chen','Thompson','Wilson','Rossi','Khalid','Silva','Patel','Tanaka','Mendez','Okafor','Nguyen','Costa','Mensah'];
    var roles = [
      ['Product Designer','Design','Product','Designer',true],['UX/UI Designer','Design','Product','Designer',false],
      ['Graphic Designer','Design','Brand','Designer',false],['Web Designer','Design','Web','Designer',false],
      ['iOS Developer','Engineering','Mobile','Developer',false],['Frontend Developer','Engineering','Web','Developer',false],
      ['Backend Developer','Engineering','Platform','Developer',false],['DevOps Engineer','Engineering','Infrastructure','Developer',true],
      ['Engineering Manager','Engineering','Platform','Developer',true],['HR Officer','Human Resources','People Ops','HR',false],
      ['HR Business Partner','Human Resources','People Ops','HR',true],['Finance Officer','Finance','Accounting','Finance',false],
      ['Finance Director','Finance','Accounting','Finance',true],['Marketing Manager','Marketing','Growth','Marketing',true],
      ['Content Strategist','Marketing','Growth','Marketing',false],['Operations Lead','Operations','Delivery','Operations',true],
      ['IT Support Analyst','Information Technology','Support','IT',false],['Network Engineer','Information Technology','Infrastructure','IT',false],
      ['QA Engineer','Engineering','Quality','Developer',false],['Data Analyst','Operations','Analytics','Analyst',false]
    ];
    var locs = ['HQ — Main Building','HQ — Block A, Floor 2','Campus A','Campus B','Remote'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    // xmur3-ish hash for stable pseudo-random.
    function h(i){ var x=(i+1)*2654435761 >>> 0; x^=x>>>15; x=Math.imul(x,2246822519)>>>0; x^=x>>>13; x=Math.imul(x,3266489917)>>>0; x^=x>>>16; return x>>>0; }
    var out = [];
    for (var i = 0; i < n; i++) {
      var v = h(i);
      var fn = first[v % first.length], ln = last[(v >>> 5) % last.length];
      var r = roles[(v >>> 10) % roles.length];
      var loc = locs[(v >>> 15) % locs.length];
      var senior = r[4]; var cat = senior ? 'Management' : 'Non-Management';
      var day = 1 + (v % 28), mon = months[(v >>> 3) % 12], yr = 2020 + ((v >>> 7) % 5);
      out.push({
        id: 'emp_' + String(i + 1),
        name: fn + ' ' + ln, designation: r[0], department: r[1], function: r[2], category: cat,
        tags: [r[3], cat],
        emp_code: 'EMP-' + yr + '-' + String(1000 + (i * 7 % 9000)),
        joining_date: (day < 10 ? '0' + day : day) + '-' + mon + '-' + yr,
        email: (fn + '.' + ln.replace(/-/g, '')).toLowerCase() + '@lyceum.edu',
        phone: '+968 24' + (10 + (v % 80)) + ' ' + (1000 + (v % 9000)),
        location: loc, reports_to: senior ? 'Office of the CEO' : 'Department Head',
        initials: (fn[0] + ln[0]).toUpperCase(), hue: v % 360, online: v % 3 === 0
      });
    }
    return out;
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
