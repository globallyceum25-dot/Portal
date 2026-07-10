/* ============================================================
   LYCEUM CONNECT — Knowledge Center (view-only)
   Modern document library. Clicking a document opens a
   paginated, read-only reader — no download / no print.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------- data ---------------- */
  var CAT = {
    'hr-policies': { label: 'Human Resources Policies', icon: '👥', color: '#4F6EF7', bg: 'var(--primary-50)' },
    'it-policies': { label: 'IT Policies & Security', icon: '🛡️', color: '#7C3AED', bg: 'rgba(124,58,237,.10)' },
    'operations':  { label: 'Operations & Facilities', icon: '⚙️', color: '#0D9488', bg: 'rgba(13,148,136,.10)' },
    'finance':     { label: 'Finance', icon: '💰', color: '#D97706', bg: 'rgba(245,158,11,.12)' },
    'legal':       { label: 'Legal & Compliance', icon: '⚖️', color: '#EF4444', bg: 'rgba(239,68,68,.10)' },
    'templates':   { label: 'Forms & Templates', icon: '📝', color: '#059669', bg: 'rgba(16,185,129,.12)' }
  };
  var TYPE = { PDF: 'type-pdf', Word: 'type-word', Excel: 'type-excel' };

  var DOCS = [
    { id: 'emp-handbook', title: 'Employee Handbook 2025', cat: 'hr-policies', type: 'PDF', pages: 124, updated: 'Jan 2025', views: 2150, featured: true, icon: '📘',
      summary: 'The official Lyceum Connect employee handbook outlining corporate routines, dress codes, leave accruals, conduct standards and organisational guidelines.' },
    { id: 'annual-leave', title: 'Annual Leave Policy', cat: 'hr-policies', type: 'PDF', pages: 15, updated: 'Dec 2024', views: 1240, icon: '📄',
      summary: 'Rules governing leave scheduling, carry-over limits, balance calculation and encashment on separation.' },
    { id: 'medical-leave', title: 'Medical Leave Policy', cat: 'hr-policies', type: 'PDF', pages: 8, updated: 'Nov 2024', views: 980, icon: '📄',
      summary: 'Guidelines for sick-leave declarations, medical certification procedures and long-term health leave.' },
    { id: 'code-conduct', title: 'Code of Conduct', cat: 'hr-policies', type: 'PDF', pages: 24, updated: 'Feb 2025', views: 2150, icon: '📄',
      summary: 'Core principles on transparency, legal compliance, workplace ethics, conflicts of interest and anti-harassment.' },
    { id: 'perf-review', title: 'Performance Review Guidelines', cat: 'hr-policies', type: 'PDF', pages: 32, updated: 'Jan 2025', views: 876, icon: '📄',
      summary: 'Process instructions for annual appraisals, self-evaluation, scoring matrices and objective setting.' },

    { id: 'it-security', title: 'IT Security Policy v3', cat: 'it-policies', type: 'PDF', pages: 48, updated: 'Mar 2025', views: 1890, featured: true, icon: '🛡️',
      summary: 'Guidelines on remote access, Active Directory password rules, VPN connectivity, software licensing, asset handling and client-information protection.' },
    { id: 'aup', title: 'Acceptable Use Policy', cat: 'it-policies', type: 'PDF', pages: 12, updated: 'Feb 2025', views: 1890, icon: '📄',
      summary: 'Standard rules for corporate device usage, personal email constraints and web-access filtering.' },
    { id: 'password', title: 'Password Management Policy', cat: 'it-policies', type: 'PDF', pages: 6, updated: 'Mar 2025', views: 2340, icon: '📄',
      summary: 'Multi-factor authentication rules, rotation requirements, complexity constraints and vault guidance.' },
    { id: 'remote-work', title: 'Remote Work Guidelines', cat: 'it-policies', type: 'PDF', pages: 10, updated: 'Jan 2025', views: 1120, icon: '📄',
      summary: 'Data-encryption rules, home-network configuration and virtual private network setup.' },
    { id: 'data-protection', title: 'Data Protection Policy', cat: 'it-policies', type: 'PDF', pages: 28, updated: 'Feb 2025', views: 654, icon: '📄',
      summary: 'Compliance guidance on user privacy, archival limits and secure file-deletion policies.' },

    { id: 'hs-manual', title: 'Health & Safety Manual', cat: 'operations', type: 'PDF', pages: 96, updated: 'Feb 2025', views: 1120, featured: true, icon: '🏥',
      summary: 'Emergency assembly plans, chemical-storage protocols, incident actions, fire-prevention mechanisms and workspace hazard-audit standards.' },
    { id: 'sop-facilities', title: 'Facilities SOP Handbook', cat: 'operations', type: 'PDF', pages: 40, updated: 'Jan 2025', views: 512, icon: '📄',
      summary: 'Standard operating procedures for maintenance, cleaning, access control and vendor coordination.' },
    { id: 'bcp', title: 'Business Continuity Plan', cat: 'operations', type: 'PDF', pages: 22, updated: 'Dec 2024', views: 388, icon: '📄',
      summary: 'Continuity strategy covering critical-service recovery, communication trees and disaster response.' },

    { id: 'travel-expense', title: 'Travel & Expense Policy', cat: 'finance', type: 'PDF', pages: 18, updated: 'Jan 2025', views: 543, icon: '📄',
      summary: 'Flight booking rules, per-diem allowances, accommodation limits and reimbursement procedures.' },
    { id: 'procurement', title: 'Procurement Policy', cat: 'finance', type: 'PDF', pages: 20, updated: 'Feb 2025', views: 410, icon: '📄',
      summary: 'Approval thresholds, vendor selection, competitive-bidding requirements and purchase-order workflow.' },

    { id: 'privacy-notice', title: 'Data Privacy Notice', cat: 'legal', type: 'PDF', pages: 14, updated: 'Feb 2025', views: 622, icon: '⚖️',
      summary: 'How the Group collects, processes and retains personal data, and the rights available to data subjects.' },
    { id: 'vendor-agreement', title: 'Vendor Agreement Template', cat: 'legal', type: 'Word', pages: 9, updated: 'Nov 2024', views: 240, icon: '📄',
      summary: 'Standard master services agreement template for engaging external vendors and contractors.' },

    { id: 'leave-form', title: 'Leave Application Form', cat: 'templates', type: 'Word', pages: 1, updated: 'Jan 2025', views: 3210, icon: '📝',
      summary: 'Standard form for requesting and approving annual leave.' },
    { id: 'expense-form', title: 'Expense Claim Form', cat: 'templates', type: 'Excel', pages: 1, updated: 'Jan 2025', views: 2870, icon: '📊',
      summary: 'Spreadsheet for logging out-of-pocket expenses and attaching receipts.' },
    { id: 'asset-form', title: 'Asset Request Form', cat: 'templates', type: 'PDF', pages: 2, updated: 'Dec 2024', views: 1450, icon: '📝',
      summary: 'Hardware requisition form with specification selectors and approval routing.' },
    { id: 'meeting-template', title: 'Meeting Request Template', cat: 'templates', type: 'Word', pages: 1, updated: 'Nov 2024', views: 987, icon: '📝',
      summary: 'Standard agenda layout for scheduling executive meetings.' }
  ];
  var byId = {}; DOCS.forEach(function (d) { byId[d.id] = d; });

  /* ---------------- document content generator ---------------- */
  function P(t) { return '<p class="pg-p">' + t + '</p>'; }
  function H(t) { return '<div class="pg-h">' + t + '</div>'; }
  function LI(items) { return items.map(function (t) { return '<div class="pg-li">' + t + '</div>'; }).join(''); }
  function genPages(d) {
    var catLabel = (CAT[d.cat] && CAT[d.cat].label) || 'Policy';
    var isForm = d.cat === 'templates';
    var pages = [];
    // cover
    pages.push('<div class="pg-cover"><div class="pg-crest">' + (d.icon || '📄') + '</div>' +
      '<h1>' + esc(d.title) + '</h1><div class="sub">Lyceum Global Holdings · ' + esc(catLabel) + '</div>' +
      '<div class="sub">Version ' + verOf(d) + ' · Last updated ' + esc(d.updated) + ' · ' + d.pages + ' page' + (d.pages === 1 ? '' : 's') + '</div>' +
      '<span class="chip">Confidential · Internal use only</span></div>');

    if (isForm) {
      pages.push(H('Instructions') + P(esc(d.summary)) +
        P('Complete every mandatory field. Forms submitted with missing information will be returned. This copy is provided for reference and reading only — to submit, use the corresponding service in the <b>Service Catalog</b>.') +
        H('Form Preview') +
        '<table class="pg-tbl"><tr><th style="width:38%">Field</th><th>Entry</th></tr>' +
        '<tr><td>Employee name</td><td>&nbsp;</td></tr><tr><td>Employee ID</td><td>&nbsp;</td></tr>' +
        '<tr><td>Department</td><td>&nbsp;</td></tr><tr><td>Date</td><td>&nbsp;</td></tr>' +
        '<tr><td>Details</td><td>&nbsp;</td></tr><tr><td>Approver signature</td><td>&nbsp;</td></tr></table>');
      return wrapPages(d, pages);
    }

    pages.push(
      H('1. Purpose') +
      P('This document — “' + esc(d.title) + '” — sets out the official position of Lyceum Global Holdings on the matters described herein. ' + esc(d.summary)) +
      P('It is maintained by the relevant governance function and reviewed periodically to ensure continued alignment with regulatory, operational and organisational requirements.') +
      H('2. Scope') +
      P('This ' + esc(catLabel.toLowerCase()) + ' document applies to all permanent, fixed-term and contract employees of the Group and its subsidiaries, as well as to authorised third parties acting on the Group’s behalf. Where local law imposes stricter requirements, the stricter requirement prevails.')
    );

    pages.push(
      H('3. Policy Statement') +
      P('The Group is committed to maintaining the highest standards in respect of the areas covered by this document. All personnel are expected to be familiar with, and to comply with, the provisions below:') +
      LI([
        'Adhere to the principles and procedures described in this document at all times.',
        'Escalate any breach, risk or ambiguity to your line manager or the responsible department without delay.',
        'Complete any mandatory training or read-confirmation associated with this document.',
        'Treat all related information as confidential and use it only for legitimate business purposes.'
      ]) +
      P('Exceptions to this policy may only be granted in writing by an authorised approver and must be documented and time-bound.')
    );

    pages.push(
      H('4. Roles & Responsibilities') +
      '<table class="pg-tbl"><tr><th style="width:34%">Role</th><th>Responsibility</th></tr>' +
      '<tr><td>All Employees</td><td>Understand and comply; confirm read where required.</td></tr>' +
      '<tr><td>Line Managers</td><td>Ensure team awareness and monitor day-to-day adherence.</td></tr>' +
      '<tr><td>Department Heads</td><td>Own local implementation and report exceptions.</td></tr>' +
      '<tr><td>Governance Function</td><td>Maintain, review and communicate updates to this document.</td></tr></table>' +
      H('5. Compliance & Enforcement') +
      P('Non-compliance with this document may result in disciplinary action, up to and including termination, and — where applicable — referral to the relevant authorities. The Group reserves the right to audit adherence at any time.')
    );

    pages.push(
      H('6. Revision History') +
      '<table class="pg-tbl"><tr><th>Version</th><th>Date</th><th>Summary of change</th></tr>' +
      '<tr><td>1.0</td><td>2023</td><td>Initial release.</td></tr>' +
      '<tr><td>2.0</td><td>2024</td><td>Annual review; scope clarified.</td></tr>' +
      '<tr><td>' + verOf(d) + '</td><td>' + esc(d.updated) + '</td><td>Current version — this document.</td></tr></table>' +
      H('Acknowledgement') +
      P('By reading this document you acknowledge that you have understood its contents. Use the <b>“Mark as read”</b> button to record your acknowledgement.')
    );
    return wrapPages(d, pages);
  }
  function verOf(d) { return d._v || (d._v = (d.type === 'PDF' ? '3.0' : '1.2')); }
  function wrapPages(d, pages) {
    var n = pages.length;
    return pages.map(function (html, i) {
      return '<div class="doc-page" id="rdpg-' + i + '"><div class="wm">LYCEUM · VIEW ONLY</div>' + html +
        '<div class="pg-foot"><span>' + esc(d.title) + ' · Confidential</span><span>Page ' + (i + 1) + ' of ' + n + '</span></div></div>';
    }).join('');
  }

  /* ---------------- render library ---------------- */
  function typeIcon(t) { return t === 'Excel' ? 'XLS' : t === 'Word' ? 'DOC' : 'PDF'; }
  function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : n; }
  function metaLine(d) { return d.type + ' · ' + d.pages + ' page' + (d.pages === 1 ? '' : 's') + ' · Updated ' + d.updated; }

  function renderFeatured() {
    var feat = DOCS.filter(function (d) { return d.featured; });
    $('featuredSection').innerHTML = feat.map(function (d, i) {
      var c = CAT[d.cat];
      return '<div class="featured-card" data-open="' + d.id + '" style="--i:' + i + '; --fc-color:' + c.color + '; --fc-bg:' + c.bg + '; --fc-glow:' + c.color + '2e">' +
        '<div class="fc-header"><span class="fc-icon">' + d.icon + '</span><span class="fc-badge">' + esc(c.label.split(' ')[0]) + '</span></div>' +
        '<div class="fc-title">' + esc(d.title) + '</div>' +
        '<div class="fc-meta"><span>' + d.pages + ' pages</span><span>Updated ' + esc(d.updated) + '</span><span>' + fmt(d.views) + ' views</span></div>' +
        '<span class="fc-view">View document <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>' +
        '</div>';
    }).join('');
  }

  function docRow(d) {
    return '<button class="doc-row" data-open="' + d.id + '" data-search="' + esc((d.title + ' ' + d.summary + ' ' + d.type).toLowerCase()) + '" type="button">' +
      '<span class="dr-ic ' + (TYPE[d.type] || 'type-pdf') + '">' + typeIcon(d.type) + '</span>' +
      '<span class="dr-main"><span class="dr-title">' + esc(d.title) + '</span><span class="dr-sub">' + esc(metaLine(d)) + '</span></span>' +
      '<span class="dr-views">' + fmt(d.views) + ' views</span>' +
      '<span class="dr-view">View <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>' +
      '</button>';
  }

  function renderSections() {
    var html = Object.keys(CAT).map(function (catKey) {
      var docs = DOCS.filter(function (d) { return d.cat === catKey; });
      if (!docs.length) return '';
      var c = CAT[catKey];
      return '<div class="doc-list-section" data-doc-cat="' + catKey + '">' +
        '<div class="dls-head"><span class="si" style="background:' + c.bg + '">' + c.icon + '</span><h3>' + esc(c.label) + '</h3><span class="cnt">' + docs.length + ' documents</span></div>' +
        docs.map(docRow).join('') + '</div>';
    }).join('');
    // FAQs section
    html += faqSection();
    $('documentListsContainer').innerHTML = html;
  }

  function faqSection() {
    var faqs = [
      { q: 'How do I reset my password?', a: 'Reset your Active Directory credentials in <b>Service Catalog → IT → Password Reset</b>, or use the ⌘K search bar and query “Password reset”.' },
      { q: 'How do I request a service letter?', a: 'Submit a request in <b>Service Catalog → Human Resources → Service Letter Request</b>. Signed letters are uploaded to your Profile within 2 business days.' },
      { q: 'What is the SLA for IT tickets?', a: 'Resolution depends on priority: Critical — 2 hours · High — 4 hours · Medium — 24 hours · Low — 3 days.' },
      { q: 'Who do I contact for payroll queries?', a: 'Raise a support ticket under HR Services, or find the Finance/Payroll managers in the Employee Directory to start a direct chat.' },
      { q: 'Can I download these documents?', a: 'No. The Knowledge Center is <b>view-only</b> — documents can be read on-screen but downloading and printing are disabled to protect confidential information.' }
    ];
    return '<div class="doc-list-section" data-doc-cat="faqs"><div class="dls-head"><span class="si" style="background:var(--bg-tertiary)">❓</span><h3>Frequently Asked Questions</h3></div>' +
      faqs.map(function (f) {
        return '<div class="faq-item" data-search="' + esc((f.q + ' ' + f.a).toLowerCase().replace(/<[^>]+>/g, '')) + '">' +
          '<button class="faq-question" type="button"><span>' + esc(f.q) + '</span><span class="faq-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><polyline points="6 9 12 15 18 9"/></svg></span></button>' +
          '<div class="faq-answer">' + f.a + '</div></div>';
      }).join('') + '</div>';
  }

  function renderRecent() {
    var ids = ['emp-handbook', 'it-security', 'annual-leave', 'expense-form'];
    $('recentRow').innerHTML = ids.map(function (id) {
      var d = byId[id]; if (!d) return '';
      return '<div class="recent-chip" data-open="' + id + '">' + d.icon + ' ' + esc(d.title) + '</div>';
    }).join('');
  }

  /* ---------------- reader (view-only) ---------------- */
  var reader = { pages: 0, page: 0, zoom: 1 };
  window.openDoc = function (id) {
    var d = byId[id]; if (!d) return;
    openViewer(d);
    d.views++; // reflect a view
  };
  function openViewer(d) {
    $('rdIc').textContent = typeIcon(d.type);
    $('rdIc').className = 'rd-ic ' + (TYPE[d.type] || 'type-pdf');
    $('rdTitle').textContent = d.title;
    $('rdMeta').textContent = d.type + ' · v' + verOf(d) + ' · ' + d.pages + ' pages · Updated ' + d.updated + ' · ' + fmt(d.views) + ' views';
    $('rdPages').innerHTML = genPages(d);
    reader.pages = $('rdPages').querySelectorAll('.doc-page').length;
    reader.page = 0; reader.zoom = 1;
    applyZoom(); updatePageLabel();
    $('rdBody').scrollTop = 0;
    $('rdRead').textContent = 'Mark as read'; $('rdRead').disabled = false;
    $('rdOverlay').classList.add('show');
    $('rdOverlay').setAttribute('aria-hidden', 'false');
  }
  function closeViewer() { $('rdOverlay').classList.remove('show'); $('rdOverlay').setAttribute('aria-hidden', 'true'); }
  function applyZoom() { $('rdPages').style.transform = 'scale(' + reader.zoom + ')'; $('rdZoomLbl').textContent = Math.round(reader.zoom * 100) + '%'; }
  function updatePageLabel() {
    $('rdPageLbl').textContent = 'Page ' + (reader.page + 1) + ' / ' + reader.pages;
    $('rdPrev').disabled = reader.page <= 0;
    $('rdNext').disabled = reader.page >= reader.pages - 1;
  }
  function goPage(n) {
    reader.page = Math.max(0, Math.min(reader.pages - 1, n));
    var pg = $('rdpg-' + reader.page);
    if (pg) $('rdBody').scrollTo({ top: pg.offsetTop - 20, behavior: 'smooth' });
    updatePageLabel();
  }

  /* ---------------- interactions ---------------- */
  window.filterChips = function (category, btn) {
    document.querySelectorAll('.chip-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    var kc = $('kcSearch'); if (kc) kc.value = '';
    document.querySelectorAll('.doc-row, .faq-item').forEach(function (r) { r.style.display = ''; });
    var feat = $('featuredSection'), ft = $('featuredTitle');
    var showFeat = category === 'all';
    if (feat) feat.style.display = showFeat ? 'grid' : 'none';
    if (ft) ft.style.display = showFeat ? 'flex' : 'none';
    document.querySelectorAll('.doc-list-section').forEach(function (s) {
      s.style.display = (category === 'all' || s.getAttribute('data-doc-cat') === category) ? 'block' : 'none';
    });
  };

  window.searchKB = function (q) {
    q = (q || '').trim().toLowerCase();
    var feat = $('featuredSection'), ft = $('featuredTitle');
    if (!q) {
      document.querySelectorAll('.doc-row, .faq-item').forEach(function (r) { r.style.display = ''; });
      document.querySelectorAll('.doc-list-section').forEach(function (s) { s.style.display = 'block'; });
      if (feat) feat.style.display = 'grid'; if (ft) ft.style.display = 'flex';
      return;
    }
    if (feat) feat.style.display = 'none'; if (ft) ft.style.display = 'none';
    document.querySelectorAll('.doc-list-section').forEach(function (s) {
      var hits = 0;
      s.querySelectorAll('.doc-row, .faq-item').forEach(function (r) {
        var t = r.getAttribute('data-search') || r.textContent.toLowerCase();
        var match = t.indexOf(q) > -1;
        r.style.display = match ? '' : 'none';
        if (match) hits++;
      });
      s.style.display = hits ? 'block' : 'none';
    });
  };

  async function boot() {
    // Hydrate the document catalogue from Supabase when signed in.
    try {
      if (window.LCData) {
        var live = await window.LCData.documents();
        if (live.source === 'supabase' && live.rows.length) {
          DOCS.length = 0;
          Array.prototype.push.apply(DOCS, live.rows);
          byId = {}; DOCS.forEach(function (d) { byId[d.id] = d; });
        }
      }
    } catch (e) { /* keep demo docs */ }

    renderFeatured();
    renderSections();
    renderRecent();

    // open handlers (delegated)
    document.addEventListener('click', function (e) {
      var open = e.target.closest('[data-open]');
      if (open) { e.preventDefault(); window.openDoc(open.getAttribute('data-open')); return; }
      var faq = e.target.closest('.faq-question');
      if (faq) {
        var item = faq.parentElement, wasOpen = item.classList.contains('open');
        item.parentElement.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
        if (!wasOpen) item.classList.add('open');
      }
    });

    // reader controls
    $('rdClose').addEventListener('click', closeViewer);
    $('rdOverlay').addEventListener('click', function (e) { if (e.target === $('rdOverlay')) closeViewer(); });
    $('rdPrev').addEventListener('click', function () { goPage(reader.page - 1); });
    $('rdNext').addEventListener('click', function () { goPage(reader.page + 1); });
    $('rdZoomIn').addEventListener('click', function () { reader.zoom = Math.min(1.5, reader.zoom + 0.1); applyZoom(); });
    $('rdZoomOut').addEventListener('click', function () { reader.zoom = Math.max(0.6, reader.zoom - 0.1); applyZoom(); });
    $('rdRead').addEventListener('click', function () { this.textContent = '✓ Marked as read'; this.disabled = true; if (window.showToast) showToast('Read confirmed', 'Your acknowledgement has been recorded.', 'success'); });
    $('rdBody').addEventListener('scroll', function () {
      var top = this.scrollTop + 60, cur = 0;
      for (var i = 0; i < reader.pages; i++) { var pg = $('rdpg-' + i); if (pg && pg.offsetTop <= top) cur = i; }
      if (cur !== reader.page) { reader.page = cur; updatePageLabel(); }
    });
    // deter download/print of the reader content
    $('rdBody').addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeViewer();
      var open = $('rdOverlay').classList.contains('show');
      if (open && (e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 's')) { e.preventDefault(); if (window.showToast) showToast('Not permitted', 'Downloading and printing are disabled for this document.', 'error'); }
      if (open && e.key === 'ArrowRight') goPage(reader.page + 1);
      if (open && e.key === 'ArrowLeft') goPage(reader.page - 1);
    });

    // count-up stats
    document.querySelectorAll('.cnt[data-to]').forEach(function (el) {
      var to = +el.dataset.to, s = performance.now(), dur = 800;
      var iv = setInterval(function () {
        var p = Math.min(1, (performance.now() - s) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p >= 1) { clearInterval(iv); el.textContent = to; }
      }, 30);
    });
    // spotlight follow on featured cards
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest('.featured-card'); if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });

    loadLive();
  }

  /* live backend documents (view-only, no download) */
  function plural(t) { return ({ Policy: 'Policies', SOP: 'SOPs', Memo: 'Memos', Form: 'Forms', Template: 'Templates' })[t] || t + 's'; }
  var liveDocs = {};
  window.openLiveDoc = function (id) {
    var d = liveDocs[id]; if (!d) return;
    openViewer({ title: d.title, type: (d.doc_type || 'PDF'), pages: 12, updated: d.updated || '2025', views: d.views || 0, cat: 'hr-policies', icon: '📄', summary: 'Live document from the Lyceum document service. ' + ((d.tags || []).join(', ')), _v: (d.version || '1.0') });
    if (d.id) LC.post('/api/documents/' + d.id + '/read', {}).catch(function () {});
  };
  async function loadLive() {
    if (!window.LC || !LC.token || !LC.token()) return;
    try {
      if (!(await LC.health())) return;
      var r = await LC.get('/api/documents');
      var docs = (r && r.documents) || [];
      if (!docs.length) return;
      var groups = {};
      docs.forEach(function (d) { liveDocs[d.id] = d; (groups[d.doc_type] = groups[d.doc_type] || []).push(d); });
      var html = Object.keys(groups).sort().map(function (type) {
        var rows = groups[type].map(function (d) {
          var badge = d.expired ? '<span class="kc-tag" style="background:#FEE2E2;color:#B91C1C">Expired</span>' : (d.expiring ? '<span class="kc-tag" style="background:#FEF3C7;color:#B45309">Expiring</span>' : '');
          return '<button class="doc-row" data-live="' + esc(d.id) + '" data-search="' + esc((d.title + ' ' + (d.tags || []).join(' ')).toLowerCase()) + '" type="button">' +
            '<span class="dr-ic type-pdf">' + esc((d.doc_type || 'DOC').slice(0, 3).toUpperCase()) + '</span>' +
            '<span class="dr-main"><span class="dr-title">' + esc(d.title) + ' ' + badge + '</span><span class="dr-sub">' + esc(d.doc_type) + ' · v' + esc(d.version || '1.0') + ' · ' + esc((d.tags || []).join(', ')) + '</span></span>' +
            '<span class="dr-view">View <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>' +
            '</button>';
        }).join('');
        return '<div class="doc-list-section" data-doc-cat="' + esc(type.toLowerCase()) + '"><div class="dls-head"><span class="si" style="background:var(--primary-50)">📄</span><h3>' + esc(plural(type)) + '</h3><span class="cnt">Live</span></div>' + rows + '</div>';
      }).join('');
      $('documentListsContainer').innerHTML = html + faqSection();
      // wire live rows
      document.querySelectorAll('.doc-row[data-live]').forEach(function (r) {
        r.addEventListener('click', function () { window.openLiveDoc(r.getAttribute('data-live')); });
      });
    } catch (e) { /* keep demo docs */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
