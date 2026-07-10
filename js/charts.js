/* ============================================================
   LYCEUM CONNECT — Tiny SVG chart helpers (Phase 5)
   Zero-dependency, theme-aware charts for the Dashboards &
   Reports module. Renders inline SVG using the design tokens so
   the visuals match the portal in both light and dark mode and
   work fully offline (no CDN chart library). Each function
   returns an SVG string; callers set container.innerHTML.
   ============================================================ */
(function () {
  'use strict';

  // Categorical palette — design-token primary plus complementary hues.
  var PALETTE = ['#4F6EF7', '#22C55E', '#EAB308', '#F472B6', '#38BDF8', '#A78BFA', '#FB923C', '#2DD4BF'];
  var STATUS_COLORS = {
    'To Do': '#94A3B8', 'In Progress': '#4F6EF7', 'Done': '#22C55E',
    submitted: '#94A3B8', pending_approval: '#EAB308', under_review: '#38BDF8',
    forwarded: '#A78BFA', acknowledged: '#4F6EF7', in_progress: '#4F6EF7',
    completed: '#22C55E', rejected: '#EF4444'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function color(i) { return PALETTE[i % PALETTE.length]; }
  function humanize(s) { return String(s).replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }

  /* Horizontal bar chart. data: [{label, value}] */
  function bars(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty(opts.empty);
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var rowH = 34, gap = 10, top = 6;
    var h = data.length * (rowH + gap) - gap + top * 2;
    var labelW = 130, barX = labelW + 10, w = 460, barW = w - barX - 44;
    var rows = data.map(function (d, i) {
      var y = top + i * (rowH + gap);
      var len = Math.max(4, (d.value / max) * barW);
      var c = opts.colorByIndex ? color(i) : (opts.color || '#4F6EF7');
      return (
        '<text x="' + labelW + '" y="' + (y + rowH / 2) + '" text-anchor="end" dominant-baseline="middle" ' +
        'font-size="12.5" fill="var(--text-secondary)">' + esc(trunc(d.label, 20)) + '</text>' +
        '<rect x="' + barX + '" y="' + y + '" width="' + barW + '" height="' + rowH + '" rx="7" fill="var(--bg-tertiary)"/>' +
        '<rect x="' + barX + '" y="' + y + '" width="' + len + '" height="' + rowH + '" rx="7" fill="' + c + '"/>' +
        '<text x="' + (barX + len + 8) + '" y="' + (y + rowH / 2) + '" dominant-baseline="middle" ' +
        'font-size="12.5" font-weight="700" fill="var(--text-primary)">' + esc(opts.fmt ? opts.fmt(d.value) : d.value) + '</text>'
      );
    }).join('');
    return svg(w, h, rows);
  }

  /* Donut chart. data: [{label, value}]. Renders legend beside it. */
  function donut(data, opts) {
    opts = opts || {};
    data = (data || []).filter(function (d) { return d.value > 0; });
    if (!data.length) return empty(opts.empty);
    var total = data.reduce(function (a, d) { return a + d.value; }, 0);
    var cx = 90, cy = 90, r = 70, stroke = 26, circ = 2 * Math.PI * r;
    var offset = 0, segs = '';
    data.forEach(function (d, i) {
      var frac = d.value / total;
      var c = opts.colorFn ? opts.colorFn(d.label) : color(i);
      segs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + c + '" ' +
        'stroke-width="' + stroke + '" stroke-dasharray="' + (frac * circ) + ' ' + circ + '" ' +
        'stroke-dashoffset="' + (-offset * circ) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      offset += frac;
    });
    var center = '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="26" font-weight="800" fill="var(--text-primary)">' + total + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">' + esc(opts.centerLabel || 'total') + '</text>';
    var legend = data.map(function (d, i) {
      var c = opts.colorFn ? opts.colorFn(d.label) : color(i);
      var pct = Math.round((d.value / total) * 100);
      return '<div class="lc-legend-row"><span class="lc-legend-dot" style="background:' + c + '"></span>' +
        '<span class="lc-legend-label">' + esc(humanize(d.label)) + '</span>' +
        '<span class="lc-legend-val">' + d.value + ' · ' + pct + '%</span></div>';
    }).join('');
    return '<div class="lc-donut-wrap">' + svg(180, 180, segs + center) + '<div class="lc-legend">' + legend + '</div></div>';
  }

  /* Line/area chart for a time series. data: [{date, value}] */
  function line(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty(opts.empty);
    var w = opts.w || 620, h = opts.h || 200, padL = 30, padR = 14, padT = 14, padB = 26;
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }));
    max = max <= 0 ? 1 : max;
    var iw = w - padL - padR, ih = h - padT - padB;
    var stepX = data.length > 1 ? iw / (data.length - 1) : 0;
    var pts = data.map(function (d, i) {
      var x = padL + i * stepX;
      var y = padT + ih - (d.value / max) * ih;
      return [x, y];
    });
    var linePath = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var areaPath = linePath + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padT + ih) + ' L' + padL + ' ' + (padT + ih) + ' Z';
    // gridlines (4)
    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (ih / 4) * g;
      grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="var(--border)" stroke-width="1"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="10" fill="var(--text-secondary)">' + Math.round(max - (max / 4) * g) + '</text>';
    }
    // sparse x labels (first, middle, last)
    var xl = '';
    [0, Math.floor(data.length / 2), data.length - 1].forEach(function (idx) {
      var x = padL + idx * stepX;
      xl += '<text x="' + x + '" y="' + (h - 8) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + esc(data[idx].date.slice(5)) + '</text>';
    });
    var dots = pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#4F6EF7"/>'; }).join('');
    var body =
      '<defs><linearGradient id="lcArea" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#4F6EF7" stop-opacity="0.28"/><stop offset="100%" stop-color="#4F6EF7" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      grid +
      '<path d="' + areaPath + '" fill="url(#lcArea)"/>' +
      '<path d="' + linePath + '" fill="none" stroke="#4F6EF7" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + xl;
    return svg(w, h, body, 'width:100%;height:auto');
  }

  /* Vertical bar chart. data: [{label, value, color?, top?, highlight?}] */
  function vbars(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty(opts.empty);
    var w = opts.w || 360, h = opts.h || 170, padB = 24, padT = 18;
    var max = opts.max || Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var n = data.length, gap = opts.gap || 12;
    var bw = (w - gap * (n + 1)) / n;
    var body = '';
    data.forEach(function (d, i) {
      var bh = Math.max(3, (d.value / max) * (h - padB - padT));
      var x = gap + i * (bw + gap), y = h - padB - bh;
      var c = d.color || (d.highlight ? (opts.accent || '#EAB308') : (opts.color || '#4F6EF7'));
      body += '<rect class="lc-vbar" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="' + Math.min(9, bw / 2) + '" fill="' + c + '" style="--i:' + i + '"/>';
      if (d.top != null) body += '<text x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-primary)">' + esc(d.top) + '</text>';
      body += '<text x="' + (x + bw / 2) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">' + esc(d.label) + '</text>';
    });
    return svg(w, h, body);
  }

  /* Radial gauge. pct 0-100. opts: {size, stroke, color, label, sub} */
  function gauge(pct, opts) {
    opts = opts || {};
    pct = Math.max(0, Math.min(100, pct));
    var size = opts.size || 132, sw = opts.stroke || 13, r = (size - sw) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
    var col = opts.color || '#4F6EF7';
    var body =
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--bg-tertiary)" stroke-width="' + sw + '"/>' +
      '<circle class="lc-gauge-fill" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - pct / 100)).toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
      '<text x="' + cx + '" y="' + (cy + (opts.sub ? -2 : 6)) + '" text-anchor="middle" font-size="' + Math.round(size * 0.22) + '" font-weight="800" fill="var(--text-primary)">' + esc(opts.label != null ? opts.label : Math.round(pct) + '%') + '</text>' +
      (opts.sub ? '<text x="' + cx + '" y="' + (cy + size * 0.17) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">' + esc(opts.sub) + '</text>' : '');
    return svg(size, size, body, 'width:' + size + 'px;height:' + size + 'px');
  }

  /* Mini sparkline from an array of numbers. */
  function sparkline(values, opts) {
    opts = opts || {};
    if (!values || values.length < 2) return '';
    var w = opts.w || 120, h = opts.h || 38, max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var rng = (max - min) || 1, step = w / (values.length - 1);
    var pts = values.map(function (v, i) { return [i * step, h - ((v - min) / rng) * (h - 8) - 4]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var col = opts.color || '#4F6EF7';
    var area = d + ' L' + w + ' ' + h + ' L0 ' + h + ' Z';
    var gid = 'spk' + Math.random().toString(36).slice(2, 7);
    return svg(w, h,
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + col + '" stop-opacity="0.28"/><stop offset="100%" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path class="lc-spark-line" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
      'width:100%;height:' + h + 'px');
  }

  /* Animated horizontal progress rows. data: [{label, value, max, color?, note?}] */
  function progressRows(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty(opts.empty);
    return '<div class="lc-prog">' + data.map(function (d, i) {
      var mx = d.max || 100, pct = Math.max(0, Math.min(100, Math.round((d.value / mx) * 100)));
      var c = d.color || color(i);
      return '<div class="lc-prog-row"><div class="lc-prog-top"><span>' + esc(d.label) + '</span><b>' + esc(d.note != null ? d.note : (d.value + '/' + mx)) + '</b></div>' +
        '<div class="lc-prog-track"><span class="lc-prog-fill" style="--w:' + pct + '%;background:' + c + '"></span></div></div>';
    }).join('') + '</div>';
  }

  function svg(w, h, body, style) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="' + (style || 'width:100%;height:auto') + '" role="img">' + body + '</svg>';
  }
  function empty(msg) {
    return '<div class="lc-chart-empty">' + esc(msg || 'No data in this scope yet.') + '</div>';
  }
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  window.LCCharts = {
    bars: bars, donut: donut, line: line,
    vbars: vbars, gauge: gauge, sparkline: sparkline, progressRows: progressRows,
    statusColor: function (k) { return STATUS_COLORS[k] || '#4F6EF7'; },
    color: color, palette: PALETTE, humanize: humanize
  };
})();
