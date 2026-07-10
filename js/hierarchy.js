/* ============================================================
   LYCEUM CONNECT — Company Hierarchy (interactive org chart)
   A dependency-free, pannable/zoomable org tree over the real
   Lyceum Global Holdings data (group → sectors → companies).
   Node positions AND their connectors are animated together in
   a single requestAnimationFrame loop, so expand/collapse,
   search-reveal and fit all move in perfect sync. Falls back
   gracefully: everything is client-side and offline-safe.
   ============================================================ */
(function () {
  'use strict';
  if (typeof SECTORS_DATA === 'undefined') return;

  var NODE_W = 210, NODE_H = 64, GX = 26, GY = 96;
  var DUR = 460;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ACCENT = { root: '#4F6EF7', sector: '#22C55E', company: '#9CA3AF' };

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('orgStage'), nodesEl = $('orgNodes'), linksEl = $('orgLinks'), viewport = $('orgViewport');
  var panel = $('orgPanel');

  var root, byId = {}, all = [];
  var pan = { x: 0, y: 0, z: 1 };
  var selected = null, raf = null;
  var view = 'tree', gridBuilt = false, curTerm = '';

  /* ---------- build tree ---------- */
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40); }
  function initials(name) {
    var w = String(name).replace(/\(private\)|limited|ltd|\.|,/gi, '').trim().split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }
  function companyNode(c, parent) {
    return register({ id: 'c-' + slug(c.name), type: 'company', name: title(c.name), sub: parent.name,
      description: c.description || '', website: c.website || '', socials: c.socials || {}, logo: c.logo || '', children: [] });
  }
  function title(s) { // tidy the SHOUTING company names
    return String(s).replace(/\s*\(private\)\s*limited/i, '').replace(/\s*limited$/i, '').replace(/\b\w+/g, function (w) {
      return w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase();
    }).trim();
  }
  function register(n) { byId[n.id] = n; all.push(n); return n; }

  function build() {
    var corp = SECTORS_DATA.filter(function (s) { return s.id === 'corporate'; })[0] || SECTORS_DATA[0];
    var others = SECTORS_DATA.filter(function (s) { return s.id !== 'corporate'; });
    root = register({ id: 'root', type: 'root', name: 'Lyceum Global Holdings', sub: 'Group Holding',
      description: corp.description, socials: {}, children: [], expanded: true });
    others.forEach(function (s) {
      var sec = register({ id: 's-' + s.id, type: 'sector', name: s.name, sub: s.holding || 'Sector Holding',
        description: s.description || '', socials: {}, children: [], expanded: false });
      sec.parent = root; root.children.push(sec);
      (s.companies || []).forEach(function (c) { var cn = companyNode(c, sec); cn.parent = sec; sec.children.push(cn); });
    });
    // Corporate's own direct subsidiaries hang straight off the group.
    (corp.companies || []).forEach(function (c) { var cn = companyNode(c, root); cn.parent = root; root.children.push(cn); });
  }

  /* ---------- tidy layout (top-down) ---------- */
  function kids(n) { return n.expanded ? n.children : []; }
  function layout() {
    var cursor = 0;
    (function place(n, depth) {
      n.depth = depth; n.ty = depth * (NODE_H + GY);
      var ks = kids(n);
      if (!ks.length) { n.tx = cursor + NODE_W / 2; cursor += NODE_W + GX; }
      else { ks.forEach(function (k) { place(k, depth + 1); }); n.tx = (ks[0].tx + ks[ks.length - 1].tx) / 2; }
    })(root, 0);
  }
  function visible() {
    var out = [];
    (function walk(n) { out.push(n); kids(n).forEach(walk); })(root);
    return out;
  }

  /* ---------- node DOM ---------- */
  function el(n) {
    if (n.el) return n.el;
    var d = document.createElement('div');
    d.className = 'org-node node-' + n.type;
    d.style.width = NODE_W + 'px'; d.style.height = NODE_H + 'px';
    d.style.setProperty('--n-accent', ACCENT[n.type]);
    var logo = n.logo
      ? '<span class="node-logo">' + initials(n.name) + '<img src="' + n.logo + '" alt="" onerror="this.remove()"></span>'
      : '<span class="node-logo">' + initials(n.name) + '</span>';
    var toggleHtml = n.children.length
      ? '<button class="node-toggle" data-toggle title="Expand / collapse"><span class="cnt">' + n.children.length + '</span></button>'
      : '';
    d.innerHTML =
      '<div class="node-card">' + logo +
        '<div class="node-body"><div class="node-name">' + esc(n.name) + '</div><div class="node-sub">' + esc(n.sub || '') + '</div></div>' +
        toggleHtml +
      '</div>';
    d.querySelector('.node-card').addEventListener('click', function () { if (suppressClick) return; onNodeClick(n); });
    var tg = d.querySelector('[data-toggle]');
    if (tg) tg.addEventListener('click', function (e) { e.stopPropagation(); if (suppressClick) return; toggle(n); });
    nodesEl.appendChild(d);
    n.el = d; n.op = 0;
    return d;
  }
  function apply(n) {
    n.el.style.transform = 'translate(' + (n.cx - NODE_W / 2) + 'px,' + n.cy + 'px)';
    n.el.style.opacity = n.op;
    n.el.classList.toggle('open', !!n.expanded && n.children.length > 0);
  }

  /* ---------- animation (nodes + links together) ---------- */
  function relayout(animated) {
    layout();
    var vis = visible(), visSet = {};
    vis.forEach(function (n) {
      visSet[n.id] = true; el(n);
      if (n.cx == null) { var p = n.parent; n.cx = p && p.cx != null ? p.cx : n.tx; n.cy = p && p.cy != null ? p.cy : n.ty; }
      n._exit = false; n.targX = n.tx; n.targY = n.ty; n.targOp = 1; n.el.style.display = '';
    });
    // exiting = has element, no longer visible
    all.forEach(function (n) {
      if (n.el && !visSet[n.id] && n !== root) {
        var p = n.parent; n._exit = true;
        n.targX = p && p.cx != null ? p.cx : n.cx; n.targY = p && p.cy != null ? p.cy : n.cy; n.targOp = 0;
      }
    });
    resizeLinks();
    animate(animated && !reduce);
    updateSelectionClasses();
  }

  function animate(animated) {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    var movers = all.filter(function (n) { return n.el && n.targOp != null; });
    if (!animated) {
      movers.forEach(function (n) { n.cx = n.targX; n.cy = n.targY; n.op = n.targOp; apply(n); finishNode(n); });
      drawLinks();
      return;
    }
    var from = movers.map(function (n) { return { n: n, x: n.cx, y: n.cy, o: n.op }; });
    var t0 = performance.now(), done = false;
    function settle() {
      if (done) return; done = true;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      movers.forEach(function (n) { n.cx = n.targX; n.cy = n.targY; n.op = n.targOp; apply(n); finishNode(n); });
      drawLinks();
    }
    function step(now) {
      var t = Math.min(1, (now - t0) / DUR), e = 1 - Math.pow(1 - t, 3);
      from.forEach(function (f) {
        f.n.cx = f.x + (f.n.targX - f.x) * e;
        f.n.cy = f.y + (f.n.targY - f.y) * e;
        f.n.op = f.o + (f.n.targOp - f.o) * e;
        apply(f.n);
      });
      drawLinks();
      if (t < 1) { raf = requestAnimationFrame(step); }
      else { settle(); }
    }
    raf = requestAnimationFrame(step);
    // Safety net: guarantee the final layout even if rAF is throttled
    // (e.g. background tab). Harmless no-op once the rAF loop finishes.
    clearTimeout(animate._t);
    animate._t = setTimeout(settle, DUR + 160);
  }
  function finishNode(n) { if (n._exit && n.el) { n.el.style.display = 'none'; } }

  /* ---------- connectors ---------- */
  function resizeLinks() {
    var maxX = 0, maxY = 0;
    visible().forEach(function (n) { maxX = Math.max(maxX, n.tx + NODE_W); maxY = Math.max(maxY, n.ty + NODE_H); });
    linksEl.setAttribute('width', maxX + 40); linksEl.setAttribute('height', maxY + 40);
    stage.style.width = (maxX + 40) + 'px'; stage.style.height = (maxY + 40) + 'px';
  }
  function drawLinks() {
    var hot = selected ? ancestorsAndSelf(selected) : {};
    var s = '';
    visible().forEach(function (p) {
      if (!p.expanded) return;
      p.children.forEach(function (c) {
        if (!c.el || c.op < 0.02) return;
        var x1 = p.cx, y1 = p.cy + NODE_H, x2 = c.cx, y2 = c.cy, my = (y1 + y2) / 2;
        var isHot = hot[p.id] && hot[c.id];
        s += '<path class="org-link' + (isHot ? ' hot' : '') + '" d="M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ',' + x2 + ' ' + my + ',' + x2 + ' ' + y2 + '"/>';
      });
    });
    linksEl.innerHTML = s;
  }
  function ancestorsAndSelf(n) { var m = {}; while (n) { m[n.id] = true; n = n.parent; } return m; }

  /* ---------- interactions ---------- */
  function toggle(n) {
    if (!n.children.length) return;
    n.expanded = !n.expanded;
    relayout(true);
  }
  function onNodeClick(n) {
    // Clicking a company pops up its performance dashboard; sectors/root
    // expand and show the structural side panel.
    if (n.type === 'company' && window.openCompanyPerformance) {
      selected = n; updateSelectionClasses();
      window.openCompanyPerformance(n);
      return;
    }
    if (n.children.length && !n.expanded) n.expanded = true;
    select(n);
    relayout(true);
  }
  function select(n) {
    selected = n; openPanel(n); updateSelectionClasses();
  }
  function updateSelectionClasses() {
    all.forEach(function (n) { if (n.el) { n.el.classList.toggle('sel', n === selected); } });
    drawLinks();
  }

  /* ---------- detail panel ---------- */
  function openPanel(n) {
    var hero = $('opHero'), body = $('opBody'), foot = $('opFoot');
    panel.style.setProperty('--n-accent', ACCENT[n.type]);
    var kind = n.type === 'root' ? 'Group Holding' : n.type === 'sector' ? 'Sector' : 'Company';
    var logo = n.logo ? '<span class="op-logo">' + initials(n.name) + '<img src="' + n.logo + '" alt="" onerror="this.remove()"></span>'
      : '<span class="op-logo">' + initials(n.name) + '</span>';
    hero.innerHTML = '<button class="op-x" id="opX"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<div class="op-hero-in">' + logo + '<div><div class="op-kind">' + kind + '</div><div class="op-name">' + esc(n.name) + '</div></div></div>';

    var html = '';
    if (n.type !== 'company') {
      var directCompanies = n.children.filter(function (c) { return c.type === 'company'; }).length;
      var subSectors = n.children.filter(function (c) { return c.type === 'sector'; }).length;
      var totalCos = countCompanies(n);
      html += '<div class="op-metrics">' +
        (subSectors ? '<div class="op-metric"><b>' + subSectors + '</b><span>Sectors</span></div>' : '') +
        '<div class="op-metric"><b>' + totalCos + '</b><span>Companies</span></div>' +
        '<div class="op-metric"><b>' + n.children.length + '</b><span>Direct</span></div>' +
      '</div>';
    }
    if (n.description) html += '<p class="op-desc">' + esc(clip(n.description, 460)) + '</p>';
    if (n.type !== 'company' && n.children.length) {
      html += '<div class="op-sec-label">Directly Held</div><div class="op-childlist">' +
        n.children.map(function (c) {
          var cl = c.logo ? '<span class="op-childlogo" style="background:' + ACCENT[c.type] + '">' + initials(c.name) + '<img src="' + c.logo + '" onerror="this.remove()"></span>'
            : '<span class="op-childlogo" style="background:' + ACCENT[c.type] + '">' + initials(c.name) + '</span>';
          return '<div class="op-childitem" data-goto="' + c.id + '">' + cl + '<div style="min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(c.name) + '</div><div style="font-size:11px;color:var(--text-tertiary)">' + (c.type === 'sector' ? countCompanies(c) + ' companies' : 'Company') + '</div></div></div>';
        }).join('') + '</div>';
    }
    var socials = Object.keys(n.socials || {}).filter(function (k) { return n.socials[k]; });
    if (socials.length) {
      html += '<div class="op-sec-label">Social</div><div class="op-socials">' +
        socials.map(function (k) { return '<a class="op-social" href="' + esc(n.socials[k]) + '" target="_blank" rel="noopener" title="' + k + '">' + socialIcon(k) + '</a>'; }).join('') + '</div>';
    }
    body.innerHTML = html || '<p class="op-desc" style="color:var(--text-tertiary)">No additional details available.</p>';

    foot.innerHTML = n.website
      ? '<a class="op-cta" href="' + esc(n.website) + '" target="_blank" rel="noopener">Visit website <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>'
      : '<a class="op-cta" style="background:var(--bg-tertiary);color:var(--text-secondary)" data-expandsel>Focus in chart</a>';

    hero.querySelector('#opX').addEventListener('click', closePanel);
    body.querySelectorAll('[data-goto]').forEach(function (it) {
      it.addEventListener('click', function () { var t = byId[it.getAttribute('data-goto')]; if (t) { onNodeClick(t); centerOn(t); } });
    });
    var ex = foot.querySelector('[data-expandsel]'); if (ex) ex.addEventListener('click', function () { centerOn(n); });

    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  }
  function closePanel() { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); selected = null; updateSelectionClasses(); }
  function countCompanies(n) { var c = 0; (function w(x) { if (x.type === 'company') c++; x.children.forEach(w); })(n); return c; }
  function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; }

  /* ---------- pan / zoom ---------- */
  function applyStage() { stage.style.transform = 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + pan.z + ')'; $('zoomLbl').textContent = Math.round(pan.z * 100) + '%'; }
  function bounds() {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    visible().forEach(function (n) { minX = Math.min(minX, n.tx - NODE_W / 2); maxX = Math.max(maxX, n.tx + NODE_W / 2); minY = Math.min(minY, n.ty); maxY = Math.max(maxY, n.ty + NODE_H); });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }
  function fit(animated) {
    var b = bounds(), vp = viewport.getBoundingClientRect(), pad = 60;
    var z = Math.min((vp.width - pad * 2) / b.w, (vp.height - pad * 2) / b.h, 1.1);
    z = Math.max(0.25, z);
    var tx = (vp.width - b.w * z) / 2 - b.minX * z;
    var ty = 40 - b.minY * z;
    tweenStage(tx, ty, z, animated);
  }
  function centerOn(n) {
    var vp = viewport.getBoundingClientRect();
    var z = Math.max(pan.z, 0.7);
    tweenStage(vp.width / 2 - n.tx * z, vp.height / 2 - (n.ty + NODE_H / 2) * z, z, true);
  }
  function tweenStage(tx, ty, tz, animated) {
    if (!animated || reduce) { pan.x = tx; pan.y = ty; pan.z = tz; applyStage(); return; }
    var f = { x: pan.x, y: pan.y, z: pan.z }, t0 = performance.now();
    (function s(now) {
      var t = Math.min(1, (now - t0) / 420), e = 1 - Math.pow(1 - t, 3);
      pan.x = f.x + (tx - f.x) * e; pan.y = f.y + (ty - f.y) * e; pan.z = f.z + (tz - f.z) * e; applyStage();
      if (t < 1) requestAnimationFrame(s);
    })(t0);
  }
  function zoomAt(cx, cy, factor) {
    var z2 = Math.min(2.2, Math.max(0.25, pan.z * factor));
    pan.x = cx - (cx - pan.x) * (z2 / pan.z); pan.y = cy - (cy - pan.y) * (z2 / pan.z); pan.z = z2; applyStage();
  }

  /* ---------- search ---------- */
  function search(term) {
    term = term.trim().toLowerCase();
    if (!term) { all.forEach(function (n) { if (n.el) n.el.classList.remove('match', 'dim'); }); return; }
    var keep = {};
    all.forEach(function (n) {
      if (n.type !== 'root' && n.name.toLowerCase().indexOf(term) >= 0) {
        n._match = true; var a = n.parent; while (a) { a.expanded = true; keep[a.id] = true; a = a.parent; } keep[n.id] = true;
      } else n._match = false;
    });
    relayout(true);
    all.forEach(function (n) {
      if (!n.el) return;
      n.el.classList.toggle('match', !!n._match);
      n.el.classList.toggle('dim', !keep[n.id] && n.type !== 'root');
    });
    var first = all.filter(function (n) { return n._match; })[0];
    if (first) setTimeout(function () { centerOn(first); }, 60);
  }

  /* ---------- grid view ---------- */
  function setView(v) {
    if (view === v) return;
    var prev = view; view = v;
    if (prev === '3d' && graph3d) { try { graph3d.pauseAnimation(); } catch (e) {} stopPulses(); }
    $('orgFrame').classList.toggle('grid-mode', v === 'grid');
    $('orgFrame').classList.toggle('threed-mode', v === '3d');
    Array.prototype.forEach.call(document.querySelectorAll('#orgSeg .seg-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === v);
    });
    if (v === 'grid') { if (!gridBuilt) buildGrid(); filterGrid(curTerm); }
    else if (v === '3d') { initThreeD(); }
    else { search(curTerm); }
  }

  /* ---------- 3D hierarchy (react-force-graph-3d's vanilla build) ---------- */
  var reduce3d = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var threeDState = null, graph3d = null;

  function bg3d() { return document.documentElement.getAttribute('data-theme') === 'dark' ? '#080b16' : '#0e1732'; }

  // Each sector gets a distinct colour (req 1).
  var SECTOR_PALETTE = ['#22C55E', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#EF4444', '#14B8A6', '#EAB308'];
  var sectorColors = {}, neighbors3d = {}, focus3dId = null;

  function buildSectorColors() {
    var i = 0;
    all.forEach(function (n) { if (n.type === 'sector') sectorColors[n.id] = SECTOR_PALETTE[i++ % SECTOR_PALETTE.length]; });
  }
  function nodeColor3d(n) {
    if (n.type === 'root') return ACCENT.root;
    if (n.type === 'sector') return sectorColors[n.id] || ACCENT.sector;
    return ACCENT.company;
  }
  function label3dColor(n) {
    if (n.type === 'root') return '#ffffff';
    if (n.type === 'sector') return sectorColors[n.id] || '#ffffff';
    return '#e8ecff';
  }
  // Is this node the focus or directly connected to it?
  function isConn3d(id) {
    if (!focus3dId) return true;
    if (id === focus3dId) return true;
    return !!(neighbors3d[focus3dId] && neighbors3d[focus3dId][id]);
  }
  // Non-connected nodes drop under 20% opacity when something is focused (req 3).
  function nodeOpacity3d(n) { return !focus3dId ? 0.9 : (isConn3d(n.id) ? 0.98 : 0.12); }
  // Group + sector labels always show; a sector's company names appear when the
  // sector (or the company itself) is focused (req 2).
  function shouldLabel3d(n) {
    if (n.type === 'root' || n.type === 'sector') return true;
    if (!focus3dId) return false;
    if (n.id === focus3dId) return true;
    var tn = byId[n.id];
    return !!(tn && tn.parent && tn.parent.id === focus3dId);
  }
  function makeNode3D(n) {
    var g = new THREE.Group();
    var r = 4.8 * Math.cbrt(n.val || 2);
    if (n.type === 'root') r *= 1.75;               // the group sits at the heart, notably larger
    var col = new THREE.Color(nodeColor3d(n));
    var seg = n.type === 'root' ? 48 : 32;          // high-poly = smooth, no facets
    // Glossy PBR material: direct-lit highlights + a soft self-glow so the
    // shaded side keeps its colour instead of going flat black.
    var big = n.type === 'root' || n.type === 'sector';
    var mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col.clone().multiplyScalar(big ? 0.3 : 0.16),
      roughness: 0.36, metalness: 0.12,
      transparent: true, opacity: nodeOpacity3d(n)
    });
    // Soft glowing halo behind the group + sector nodes (pulses via the timer).
    if (big && typeof THREE !== 'undefined') {
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: pulseTexture(), color: col.clone(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      var hb = r * (n.type === 'root' ? 3.4 : 3.0);
      halo.scale.set(hb, hb, 1);
      halo.userData.halo = { base: hb, op: (focus3dId && !isConn3d(n.id)) ? 0.08 : 0.5, ph: Math.random() * 6.283 };
      g.add(halo);
    }
    var sphere = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat);
    sphere.castShadow = true; sphere.receiveShadow = true;
    if (n.id === focus3dId) sphere.scale.set(1.35, 1.35, 1.35);
    g.add(sphere);
    if (typeof SpriteText !== 'undefined' && shouldLabel3d(n)) {
      var s = new SpriteText(n.name);
      s.color = big ? '#ffffff' : label3dColor(n);
      s.textHeight = n.type === 'root' ? 6.4 : n.type === 'sector' ? 4.6 : 2.4;
      s.fontWeight = big ? '800' : '700';
      s.fontFace = 'Inter, Segoe UI, sans-serif';
      s.strokeWidth = big ? 0.6 : 0;
      s.strokeColor = 'rgba(0,0,0,0.92)';
      if (big) {
        s.backgroundColor = n.type === 'root' ? 'rgba(79,110,247,0.92)' : 'rgba(10,14,26,0.82)';
        s.padding = n.type === 'root' ? 4 : 3;
        s.borderRadius = 5;
        s.borderWidth = 0.5;
        s.borderColor = n.type === 'root' ? 'rgba(255,255,255,0.5)' : (sectorColors[n.id] || 'rgba(255,255,255,0.35)');
      } else { s.backgroundColor = false; }
      if (s.material) { s.material.transparent = true; s.material.opacity = (focus3dId && !isConn3d(n.id)) ? 0.12 : 1; s.material.depthWrite = false; }
      s.renderOrder = 10;
      s.position.set(0, r + (n.type === 'root' ? 9 : n.type === 'sector' ? 7 : 4), 0);
      g.add(s);
    }
    return g;
  }
  function linkColor3d(l) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var s = (l.source && l.source.id) || l.source, t = (l.target && l.target.id) || l.target;
    if (!focus3dId) return dark ? 'rgba(150,170,220,0.32)' : 'rgba(120,150,230,0.42)';
    if (s === focus3dId || t === focus3dId) return 'rgba(160,190,255,0.9)';
    return 'rgba(130,150,200,0.05)';
  }
  /* ---- Glowing energy-pulse waves travelling along every connection ---- */
  var pulse = { sprites: [], halos: [], tex: null, timer: null };
  // Gather the glow halos currently in the scene so the timer can pulse them.
  function collectHalos() {
    pulse.halos = [];
    if (!graph3d) return;
    try { graph3d.scene().traverse(function (o) { if (o.userData && o.userData.halo) pulse.halos.push(o); }); } catch (e) {}
  }

  // A soft radial-gradient sprite = a glowing dot. Additive blending makes the
  // pulses read as light/energy rather than solid balls.
  function pulseTexture() {
    if (pulse.tex) return pulse.tex;
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0.0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.28)');
    grd.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    pulse.tex = new THREE.Texture(c); pulse.tex.needsUpdate = true;
    return pulse.tex;
  }

  // Soft light-blue particles flowing along the links (the original look).
  function pulseColor() { return '#9db8ff'; }

  function clearPulses() {
    var sc = graph3d && graph3d.scene && graph3d.scene();
    pulse.sprites.forEach(function (p) { if (sc) sc.remove(p.sp); if (p.sp.material) p.sp.material.dispose(); });
    pulse.sprites = [];
  }

  function buildPulses() {
    if (!graph3d || reduce3d || typeof THREE === 'undefined') return;
    clearPulses();
    var sc = graph3d.scene();
    var tex = pulseTexture();
    var links = graph3d.graphData().links;
    var PER = 3; // pulses per link -> a continuous flowing wave
    links.forEach(function (l) {
      var col = new THREE.Color(pulseColor(l));
      for (var i = 0; i < PER; i++) {
        var m = new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
        var sp = new THREE.Sprite(m);
        sp.scale.set(3, 3, 3);
        sc.add(sp);
        var p = { sp: sp, mat: m, link: l, phase: i / PER + Math.random() * 0.04, speed: 0.32 + Math.random() * 0.12 };
        placePulse(p);            // seat it on the link immediately (never at origin)
        pulse.sprites.push(p);
      }
    });
    startPulses();
    collectHalos();
  }

  // Position one pulse along its link at its current phase. A gentle fade at the
  // two endpoints keeps the flow soft rather than popping in/out.
  function placePulse(p) {
    var l = p.link, s = l.source, t = l.target;
    if (!s || !t || typeof s.x !== 'number' || typeof t.x !== 'number') return;
    var e = p.phase;
    p.sp.position.set(s.x + (t.x - s.x) * e, s.y + (t.y - s.y) * e, s.z + (t.z - s.z) * e);
    var a = Math.min(1, Math.sin(e * Math.PI) * 1.6); // full brightness across most of the link
    var touches = !focus3dId || s.id === focus3dId || t.id === focus3dId;
    var base = !focus3dId ? 0.85 : (touches ? 0.95 : 0.06);
    p.mat.opacity = base * (0.35 + 0.65 * a);
    var sz = (2.4 + 1.4 * a) * (touches ? 1 : 0.6);
    p.sp.scale.set(sz, sz, sz);
  }

  // Drive the pulses from a timer (not rAF) and force a render each tick. rAF is
  // paused whenever the tab is idle, which would freeze the whole animation; a
  // timer keeps firing, so the pulse waves keep flowing even with no interaction.
  // Phase advances by real elapsed time (not a fixed step) so the motion stays
  // smooth and constant-speed even if a tick runs late.
  var pulseLast = 0;
  function pulseTick() {
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var dt = pulseLast ? Math.min((now - pulseLast) / 1000, 0.05) : 0.016;
    pulseLast = now;
    for (var k = 0; k < pulse.sprites.length; k++) {
      var p = pulse.sprites[k];
      p.phase += p.speed * dt;
      if (p.phase >= 1) p.phase -= 1;
      placePulse(p);
    }
    // gently pulse the main + sector glow halos
    if (pulse.halos.length) {
      var tt = now / 620;
      for (var h = 0; h < pulse.halos.length; h++) {
        var ho = pulse.halos[h], u = ho.userData.halo, w = 0.5 + 0.5 * Math.sin(tt + u.ph);
        var sc2 = u.base * (0.9 + 0.18 * w);
        ho.scale.set(sc2, sc2, 1);
        if (ho.material) ho.material.opacity = u.op * (0.55 + 0.45 * w);
      }
    }
    if (!graph3d) return;
    try { var c = graph3d.controls(); if (c && c.update) c.update(); } catch (e) {}
    try { graph3d.renderer().render(graph3d.scene(), graph3d.camera()); } catch (e) {}
  }
  function startPulses() {
    if (reduce3d || pulse.timer) return;
    pulseLast = 0;
    pulse.timer = setInterval(pulseTick, 16); // ~60fps for smooth motion
  }
  function stopPulses() {
    if (pulse.timer) { clearInterval(pulse.timer); pulse.timer = null; }
  }
  function applyFocus3d() {
    if (!graph3d) return;
    graph3d.nodeThreeObject(function (n) { return makeNode3D(n); });
    graph3d.linkColor(linkColor3d);
    setTimeout(collectHalos, 140);   // re-gather halos after nodes regenerate
  }
  function resetFocus3d() {
    if (!focus3dId) return;
    focus3dId = null;
    applyFocus3d();
    if (!reduce3d) { try { graph3d.controls().autoRotate = true; } catch (e) {} }
    setTimeout(function () {
      try { var d = graph3d.graphData(), r = 0; d.nodes.forEach(function (n) { var m = Math.hypot(n.x || 0, n.y || 0, n.z || 0); if (m > r) r = m; }); if (r > 0) graph3d.cameraPosition({ x: 0, y: 0, z: r * 3.5 }, { x: 0, y: 0, z: 0 }, 700); } catch (e) {}
    }, 30);
  }

  // Enable soft shadow-mapping and add a key/fill light rig so the spheres read
  // as solid 3D objects that cast shadows on each other.
  function setupLighting3D(G) {
    try {
      var rnd = G.renderer();
      rnd.shadowMap.enabled = true;
      rnd.shadowMap.type = THREE.PCFSoftShadowMap;
      var scene = G.scene();
      var key = new THREE.DirectionalLight(0xffffff, 1.0);
      key.position.set(140, 220, 170);
      key.castShadow = true;
      key.shadow.mapSize.width = key.shadow.mapSize.height = 2048;
      key.shadow.radius = 4;
      key.shadow.bias = -0.0005;
      var cam = key.shadow.camera;
      cam.left = -180; cam.right = 180; cam.top = 180; cam.bottom = -180; cam.near = 10; cam.far = 800;
      scene.add(key);
      // Cool fill from the opposite side keeps shadowed faces from crushing to black.
      var fill = new THREE.DirectionalLight(0x9db8ff, 0.3);
      fill.position.set(-130, -90, -150);
      scene.add(fill);
    } catch (e) {}
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  function initThreeD() {
    if (threeDState === 'ready') { try { graph3d.resumeAnimation(); } catch (e) {} startPulses(); setTimeout(resize3D, 40); return; }
    if (threeDState === 'error') { $('org3dLoading').style.display = 'none'; $('org3dError').style.display = 'flex'; return; }
    if (threeDState === 'loading') return;
    threeDState = 'loading';
    $('org3dLoading').style.display = 'flex';
    // Load a global THREE first (three-spritetext's UMD needs it to define the
    // SpriteText global), then the sprite-text helper, then 3d-force-graph.
    loadScript('https://unpkg.com/three@0.150.1/build/three.min.js')
      .then(function () { return loadScript('https://unpkg.com/three-spritetext@1.8.2/dist/three-spritetext.min.js'); })
      .then(function () { return loadScript('https://unpkg.com/3d-force-graph@1.73.4/dist/3d-force-graph.min.js'); })
      .then(function () {
        if (typeof ForceGraph3D === 'undefined') throw new Error('lib missing');
        $('org3dLoading').style.display = 'none';
        buildGraph3D();
        threeDState = 'ready';
      })
      .catch(function () {
        threeDState = 'error';
        $('org3dLoading').style.display = 'none';
        $('org3dError').style.display = 'flex';
      });
  }

  function buildGraph3D() {
    var nodes = all.map(function (n) {
      return { id: n.id, name: n.name, type: n.type, color: ACCENT[n.type],
        val: n.type === 'root' ? 7 : n.type === 'sector' ? 4 : 1.6 };
    });
    var links = [];
    all.forEach(function (n) { if (n.parent) links.push({ source: n.parent.id, target: n.id }); });

    buildSectorColors();
    neighbors3d = {}; focus3dId = null;
    links.forEach(function (l) {
      (neighbors3d[l.source] = neighbors3d[l.source] || {})[l.target] = true;
      (neighbors3d[l.target] = neighbors3d[l.target] || {})[l.source] = true;
    });

    var el = document.getElementById('org3dCanvas');
    var G = ForceGraph3D()(el)
      .graphData({ nodes: nodes, links: links })
      .backgroundColor(bg3d())
      .showNavInfo(false)
      .nodeLabel(function (n) { return '<div style="font:600 12px Inter,sans-serif;color:#fff;background:rgba(10,14,28,.9);padding:5px 10px;border-radius:8px">' + n.name + '</div>'; })
      .nodeThreeObjectExtend(false)
      .nodeThreeObject(function (n) { return makeNode3D(n); })
      .linkColor(linkColor3d)
      .linkOpacity(0.55)
      .linkWidth(0.7)
      .onNodeClick(onNode3DClick)
      .onBackgroundClick(resetFocus3d)
      .width(el.clientWidth || 800)
      .height(el.clientHeight || 500);

    setupLighting3D(G);
    // Spread nodes further apart so labels don't collide / clump.
    try { G.d3Force('charge').strength(-250); } catch (e) {}
    try { G.d3Force('link').distance(function (l) { var s = (l.source && l.source.type) || l.source; return s === 'root' ? 88 : 50; }); } catch (e) {}
    if (!reduce3d) { try { var c = G.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.6; } catch (e) {} }
    graph3d = G;
    // Frame with zoomToFit so the whole graph is centred and fits the viewport
    // on any screen size / aspect ratio (responsive), with breathing room.
    function frame3D(ms) {
      try { G.zoomToFit(ms == null ? 800 : ms, 20); } catch (e) {}
    }
    setTimeout(function () { frame3D(800); }, 1800);
    setTimeout(function () { frame3D(800); }, 3800);
    // Spin up the glowing pulse-wave streams once the graph is on screen.
    setTimeout(buildPulses, 1200);

    // Freeze the layout once it settles: pin every node at its resting position
    // so the nodes stop drifting. The only motion left is the pulse waves
    // travelling along the connections (link particles) + camera orbit.
    var pinned = false;
    function pinNodes() {
      if (pinned) return; pinned = true;
      try { G.graphData().nodes.forEach(function (n) { n.fx = n.x; n.fy = n.y; n.fz = n.z; }); } catch (e) {}
      setTimeout(function () { frame3D(0); }, 60); // crisp final fit once settled
    }
    G.onEngineStop(pinNodes);
    setTimeout(pinNodes, 5000); // fallback if the engine never reports a stop

    // Responsive: re-size the renderer and re-fit whenever the container changes
    // (window resize, sidebar collapse, entering the view, fullscreen…).
    function onContainerResize() {
      resize3D();
      clearTimeout(window._org3dRfit);
      window._org3dRfit = setTimeout(function () { fitAll3D(0); }, 180);
    }
    window.addEventListener('resize', onContainerResize);
    try { new ResizeObserver(onContainerResize).observe(document.getElementById('org3dCanvas')); } catch (e) {}
    // Keep the 3D background in sync with light/dark toggles.
    new MutationObserver(function () { if (graph3d) graph3d.backgroundColor(bg3d()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function onNode3DClick(node) {
    focus3dId = node.id;
    applyFocus3d();
    if (!reduce3d) { try { graph3d.controls().autoRotate = false; } catch (e) {} } // hold still so labels read
    var tn = byId[node.id];

    if (tn && tn.type === 'sector') {
      // Frame the sector + its companies so all their names fit on screen (req 2).
      var keep = {}; keep[node.id] = true;
      all.forEach(function (m) { if (m.parent && m.parent.id === tn.id) keep[m.id] = true; });
      setTimeout(function () { try { graph3d.zoomToFit(800, 90, function (nd) { return keep[nd.id]; }); } catch (e) {} }, 80);
    } else {
      var d = Math.hypot(node.x || 0.1, node.y || 0.1, node.z || 0.1), ratio = 1 + 150 / d;
      try { graph3d.cameraPosition({ x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio }, node, 900); } catch (e) {}
      if (tn && tn.type === 'company' && window.openCompanyPerformance) window.openCompanyPerformance(tn);
    }
  }

  function resize3D() {
    if (!graph3d) return;
    var el = document.getElementById('org3dCanvas');
    var w = el.clientWidth, h = el.clientHeight;
    if (w < 2 || h < 2) return;   // view hidden — don't collapse the renderer to 0
    graph3d.width(w).height(h);
  }

  // Fit the whole graph neatly inside the current viewport.
  function fitAll3D(ms) {
    if (!graph3d) return;
    try { graph3d.zoomToFit(ms == null ? 600 : ms, 20); } catch (e) {}
  }

  function is3DFullscreen() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    return fs === document.getElementById('org3d');
  }
  function toggleFullscreen3D() {
    var el = document.getElementById('org3d');
    if (!el) return;
    if (!is3DFullscreen()) {
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        try {
          var p = req.call(el);
          if (p && p.catch) p.catch(function () { fitAll3D(); }); // blocked (e.g. sandboxed) → at least fit
        } catch (e) { fitAll3D(); }
      } else { fitAll3D(); }
    } else {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { try { exit.call(document); } catch (e) {} }
    }
  }
  // On enter/exit fullscreen the canvas size changes — resize the renderer and
  // re-fit the graph, and swap the button icon.
  function on3DFullscreenChange() {
    var fs = is3DFullscreen();
    var btn = document.getElementById('org3dFs');
    if (btn) {
      var open = btn.querySelector('.fs-open'), close = btn.querySelector('.fs-close');
      if (open) open.style.display = fs ? 'none' : '';
      if (close) close.style.display = fs ? '' : 'none';
      btn.title = fs ? 'Exit full screen' : 'Fit to full screen';
    }
    setTimeout(function () { resize3D(); fitAll3D(700); }, 90);
    setTimeout(function () { resize3D(); fitAll3D(0); }, 320);
  }

  function focus3D(term) {
    if (!graph3d || !term) return;
    var t = term.trim().toLowerCase();
    var data = graph3d.graphData();
    var hit = data.nodes.filter(function (n) { return n.type !== 'root' && n.name.toLowerCase().indexOf(t) >= 0; })[0];
    if (hit && hit.x != null) onNode3DClick(hit);
  }

  function buildGrid() {
    var sectors = root.children.filter(function (t) { return t.type === 'sector'; });
    var direct = root.children.filter(function (t) { return t.type === 'company'; });
    var html = '<div class="org-gridsum">' +
      pill(sectors.length, 'Sectors') + pill(countCompanies(root), 'Companies') + pill(root.children.length, 'Direct holdings') + '</div>';
    html += sectors.map(sectionHTML).join('');
    if (direct.length) html += sectionHTML({ id: 'root', type: 'direct', name: 'Direct Subsidiaries', sub: 'Held directly by the group', children: direct });
    html += '<div class="grid-noresults" id="gridNoResults">No companies match your search.</div>';
    $('orgGrid').innerHTML = html;
    $('orgGrid').addEventListener('click', onGridClick);
    gridBuilt = true;
  }
  function pill(v, l) { return '<div class="gs-pill"><b>' + v + '</b><span>' + l + '</span></div>'; }

  function sectionHTML(sec) {
    var accent = sec.type === 'sector' ? ACCENT.sector : ACCENT.root;
    var logo = '<span class="gsec-logo" style="background:' + accent + '">' + initials(sec.name) + (sec.logo ? '<img src="' + sec.logo + '" onerror="this.remove()">' : '') + '</span>';
    var n = sec.children.length;
    return '<div class="grid-section" data-sec="' + sec.id + '">' +
      '<div class="gsec-head">' + logo +
        '<div style="min-width:0"><div class="gsec-title">' + esc(sec.name) + '</div><div class="gsec-sub">' + esc(sec.sub || '') + '</div></div>' +
        '<span class="gsec-count">' + n + ' ' + (n === 1 ? 'company' : 'companies') + '</span>' +
      '</div>' +
      '<div class="gsec-cards">' + sec.children.map(cardHTML).join('') + '</div>' +
    '</div>';
  }

  function cardHTML(c, j) {
    var logo = '<span class="co-logo">' + initials(c.name) + (c.logo ? '<img src="' + c.logo + '" onerror="this.remove()">' : '') + '</span>';
    var socials = Object.keys(c.socials || {}).filter(function (k) { return c.socials[k]; });
    var soc = socials.slice(0, 4).map(function (k) { return '<a class="co-soc" href="' + esc(c.socials[k]) + '" target="_blank" rel="noopener" title="' + k + '" onclick="event.stopPropagation()">' + socialIcon(k) + '</a>'; }).join('');
    var web = c.website
      ? '<a class="co-web" href="' + esc(c.website) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Website</a>'
      : '<span class="co-empty">Private company</span>';
    return '<div class="co-card" data-card="' + c.id + '" style="--j:' + (j % 10) + '">' +
      '<div class="co-top">' + logo + '<div style="min-width:0"><div class="co-name">' + esc(c.name) + '</div><div class="co-sub">' + esc(c.sub || '') + '</div></div></div>' +
      '<div class="co-foot">' + web + '<div class="co-socials">' + soc + '</div></div>' +
    '</div>';
  }

  function onGridClick(e) {
    if (e.target.closest('a')) return;
    var card = e.target.closest('.co-card'); if (!card) return;
    var n = byId[card.getAttribute('data-card')];
    if (!n) return;
    if (window.openCompanyPerformance) window.openCompanyPerformance(n);
    else { selected = n; openPanel(n); }
  }

  function filterGrid(term) {
    term = (term || '').trim().toLowerCase();
    var any = false;
    document.querySelectorAll('#orgGrid .grid-section').forEach(function (sec) {
      var shown = 0;
      sec.querySelectorAll('.co-card').forEach(function (card) {
        var n = byId[card.getAttribute('data-card')];
        var m = !term || (n && n.name.toLowerCase().indexOf(term) >= 0);
        card.classList.toggle('hidden', !m); if (m) shown++;
      });
      sec.classList.toggle('hidden', shown === 0);
      if (shown > 0) any = true;
    });
    var nr = $('gridNoResults'); if (nr) nr.style.display = any ? 'none' : 'block';
  }

  /* ---------- wire ---------- */
  function wire() {
    document.querySelectorAll('#orgSeg .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });
    $('zoomIn').addEventListener('click', function () { var r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.2); });
    $('zoomOut').addEventListener('click', function () { var r = viewport.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.2); });
    $('zoomFit').addEventListener('click', function () { fit(true); });
    $('orgExpand').addEventListener('click', function () { all.forEach(function (n) { if (n.children.length) n.expanded = true; }); relayout(true); setTimeout(function () { fit(true); }, 30); });
    $('orgCollapse').addEventListener('click', function () { all.forEach(function (n) { if (n !== root) n.expanded = false; }); closePanel(); relayout(true); setTimeout(function () { fit(true); }, 30); });

    var fsBtn = $('org3dFs');
    if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen3D);
    document.addEventListener('fullscreenchange', on3DFullscreenChange);
    document.addEventListener('webkitfullscreenchange', on3DFullscreenChange);

    var si = $('orgSearch'), stimer;
    si.addEventListener('input', function () {
      curTerm = si.value;
      clearTimeout(stimer);
      stimer = setTimeout(function () { if (view === 'grid') filterGrid(curTerm); else if (view === '3d') focus3D(curTerm); else search(curTerm); }, 220);
    });

    // pan + wheel zoom
    var down = false, sx = 0, sy = 0, moved = 0;
    viewport.addEventListener('pointerdown', function (e) {
      down = true; moved = 0; suppressClick = false; sx = e.clientX; sy = e.clientY;
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = e.clientX; sy = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) { suppressClick = true; viewport.classList.add('grabbing'); $('orgHint').classList.add('hide'); }
      pan.x += dx; pan.y += dy; applyStage();
    });
    function end() { down = false; viewport.classList.remove('grabbing'); }
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
    viewport.addEventListener('wheel', function (e) {
      e.preventDefault(); var r = viewport.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12); $('orgHint').classList.add('hide');
    }, { passive: false });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
    window.addEventListener('resize', function () { clearTimeout(window._orgR); window._orgR = setTimeout(function () { fit(false); }, 150); });
  }

  var suppressClick = false;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function socialIcon(k) {
    var p = {
      facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
      instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/>',
      linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
      youtube: '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>',
      tiktok: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>'
    };
    return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (p[k] || '<circle cx="12" cy="12" r="9"/>') + '</svg>';
  }

  /* ---------- go ---------- */
  build();
  relayout(false);   // create nodes at their resting positions
  fit(false);        // frame the whole tree
  wire();
  // entrance: collapse everything onto the group node, then unfold outward
  if (!reduce) {
    requestAnimationFrame(function () {
      visible().forEach(function (n) { if (n !== root) { n.cx = root.cx; n.cy = root.cy; n.op = 0; apply(n); } });
      drawLinks();
      requestAnimationFrame(function () { relayout(true); });
    });
  }
  setTimeout(function () { $('orgHint').classList.remove('hide'); }, 400);
})();
