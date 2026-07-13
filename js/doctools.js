/* ============================================================
   LYCEUM CONNECT — Document Tools (Phase 6, spec §13.2)
   100% CLIENT-SIDE document conversion. No file ever leaves the
   browser during conversion — all work is in-memory using pdf-lib,
   pdf.js and JSZip. Only an explicit "Add to Knowledge Center"
   (admins) writes a metadata catalogue entry; the binary stays local.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmtSize(n) { if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function readAB(file) { return file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer(); }

  // pdf.js worker
  function ensurePdfJs() {
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }

  /* ---------------- state ---------------- */
  var state = { tool: null, files: [], result: null };

  /* ---------------- tool registry ---------------- */
  var ICON = {
    img2pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="13" r="2"/><path d="m20 17-1.5-1.5a2 2 0 0 0-3 0L9 22"/>',
    merge: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="9" y1="12" x2="15" y2="12"/>',
    split: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 15h8"/>',
    pdf2img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L5 21"/>',
    organize: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    compress: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="m11 13-2 2 2 2"/><path d="m13 13 2 2-2 2"/>',
    word2pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m8 13 1.5 5 1.5-3 1.5 3L14 13"/>',
    pdf2word: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'
  };

  function svg(paths) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>'; }

  var TOOLS = {
    img2pdf: {
      title: 'Images → PDF', desc: 'Combine JPG / PNG / WebP images into one PDF.', color: '#4F6EF7',
      accept: 'image/*', multi: true, minFiles: 1,
      options: '<label class="dt-opt"><span>Page size</span><select id="optPage" class="form-control form-select"><option value="fit">Fit to image</option><option value="a4">A4 portrait</option><option value="a4l">A4 landscape</option></select></label>' +
               '<label class="dt-opt"><span>Margin</span><select id="optMargin" class="form-control form-select"><option value="0">None</option><option value="24" selected>Small</option><option value="48">Medium</option></select></label>',
      run: async function (files, onP) {
        var out = await PDFLib.PDFDocument.create();
        var mode = ($('optPage') || {}).value || 'fit';
        var margin = parseFloat(($('optMargin') || {}).value || '24');
        var A4 = [595.28, 841.89];
        for (var i = 0; i < files.length; i++) {
          var bytes = new Uint8Array(await readAB(files[i]));
          var img, t = files[i].type;
          if (/png/i.test(t)) img = await out.embedPng(bytes);
          else if (/jpe?g/i.test(t)) img = await out.embedJpg(bytes);
          else { img = await embedViaCanvas(out, files[i]); }
          var iw = img.width, ih = img.height, page;
          if (mode === 'fit') { page = out.addPage([iw + margin * 2, ih + margin * 2]); page.drawImage(img, { x: margin, y: margin, width: iw, height: ih }); }
          else {
            var size = mode === 'a4l' ? [A4[1], A4[0]] : A4; page = out.addPage(size);
            var maxW = size[0] - margin * 2, maxH = size[1] - margin * 2;
            var s = Math.min(maxW / iw, maxH / ih); var w = iw * s, h = ih * s;
            page.drawImage(img, { x: (size[0] - w) / 2, y: (size[1] - h) / 2, width: w, height: h });
          }
          onP((i + 1) / files.length);
        }
        var data = await out.save();
        return { blob: new Blob([data], { type: 'application/pdf' }), filename: 'images.pdf', kind: 'PDF' };
      }
    },
    merge: {
      title: 'Merge PDFs', desc: 'Join several PDFs into a single document (drag to reorder).', color: '#7C3AED',
      accept: 'application/pdf', multi: true, minFiles: 2, reorder: true,
      options: '',
      run: async function (files, onP) {
        var out = await PDFLib.PDFDocument.create();
        for (var i = 0; i < files.length; i++) {
          var src = await PDFLib.PDFDocument.load(new Uint8Array(await readAB(files[i])), { ignoreEncryption: true });
          var pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(function (p) { out.addPage(p); });
          onP((i + 1) / files.length);
        }
        var data = await out.save();
        return { blob: new Blob([data], { type: 'application/pdf' }), filename: 'merged.pdf', kind: 'PDF' };
      }
    },
    split: {
      title: 'Split PDF', desc: 'Extract a page range, or split every page into its own file.', color: '#EC4899',
      accept: 'application/pdf', multi: false, minFiles: 1,
      options: '<label class="dt-opt"><span>Mode</span><select id="optSplit" class="form-control form-select"><option value="range">Extract page range</option><option value="each">Every page → separate files (.zip)</option></select></label>' +
               '<label class="dt-opt"><span>Pages (e.g. 1-3,5)</span><input id="optRange" class="form-control" placeholder="1-3,5" value="1"></label>',
      run: async function (files, onP) {
        var src = await PDFLib.PDFDocument.load(new Uint8Array(await readAB(files[0])), { ignoreEncryption: true });
        var total = src.getPageCount();
        var mode = ($('optSplit') || {}).value || 'range';
        if (mode === 'each') {
          var zip = new JSZip();
          for (var p = 0; p < total; p++) {
            var d = await PDFLib.PDFDocument.create();
            var cp = await d.copyPages(src, [p]); d.addPage(cp[0]);
            zip.file('page-' + (p + 1) + '.pdf', await d.save());
            onP((p + 1) / total);
          }
          return { blob: await zip.generateAsync({ type: 'blob' }), filename: 'split-pages.zip', kind: 'ZIP' };
        }
        var idx = parseRange(($('optRange') || {}).value || '1', total);
        if (!idx.length) throw new Error('No valid pages in that range (document has ' + total + ' pages).');
        var out = await PDFLib.PDFDocument.create();
        var cps = await out.copyPages(src, idx); cps.forEach(function (pg) { out.addPage(pg); });
        onP(1);
        var data = await out.save();
        return { blob: new Blob([data], { type: 'application/pdf' }), filename: 'extracted.pdf', kind: 'PDF' };
      }
    },
    pdf2img: {
      title: 'PDF → Images', desc: 'Render each page to a PNG image (delivered as a .zip).', color: '#0EA5E9',
      accept: 'application/pdf', multi: false, minFiles: 1,
      options: '<label class="dt-opt"><span>Quality</span><select id="optScale" class="form-control form-select"><option value="1">Standard</option><option value="1.6" selected>High</option><option value="2.4">Very high</option></select></label>',
      run: async function (files, onP) {
        ensurePdfJs();
        var scale = parseFloat(($('optScale') || {}).value || '1.6');
        var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await readAB(files[0])) }).promise;
        var zip = new JSZip();
        for (var n = 1; n <= pdf.numPages; n++) {
          var page = await pdf.getPage(n);
          var vp = page.getViewport({ scale: scale });
          var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
          zip.file('page-' + n + '.png', blob);
          onP(n / pdf.numPages);
        }
        return { blob: await zip.generateAsync({ type: 'blob' }), filename: 'pdf-images.zip', kind: 'ZIP' };
      }
    },
    compress: {
      title: 'Compress PDF', desc: 'Re-optimise a PDF to reduce its file size.', color: '#22C55E',
      accept: 'application/pdf', multi: false, minFiles: 1,
      options: '',
      run: async function (files, onP) {
        var before = files[0].size;
        var src = await PDFLib.PDFDocument.load(new Uint8Array(await readAB(files[0])), { ignoreEncryption: true });
        onP(0.5);
        var data = await src.save({ useObjectStreams: true });
        onP(1);
        var after = data.byteLength;
        var saved = before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;
        return { blob: new Blob([data], { type: 'application/pdf' }), filename: 'compressed.pdf', kind: 'PDF',
          note: 'Reduced by ~' + saved + '% (' + fmtSize(before) + ' → ' + fmtSize(after) + ').' };
      }
    },
    organize: {
      title: 'Organise PDF', desc: 'Rotate, delete or reorder pages, then rebuild.', color: '#F59E0B',
      accept: 'application/pdf', multi: false, minFiles: 1, organize: true,
      options: '<div id="orgGrid" class="dt-org-grid"></div>',
      run: async function (files, onP) {
        var src = await PDFLib.PDFDocument.load(new Uint8Array(await readAB(files[0])), { ignoreEncryption: true });
        var out = await PDFLib.PDFDocument.create();
        var order = state.orgPages.filter(function (p) { return !p.del; });
        if (!order.length) throw new Error('All pages are marked for deletion.');
        var copied = await out.copyPages(src, order.map(function (p) { return p.i; }));
        for (var k = 0; k < copied.length; k++) {
          var pg = copied[k];
          if (order[k].rot) pg.setRotation(PDFLib.degrees((pg.getRotation().angle + order[k].rot) % 360));
          out.addPage(pg); onP((k + 1) / copied.length);
        }
        var data = await out.save();
        return { blob: new Blob([data], { type: 'application/pdf' }), filename: 'organised.pdf', kind: 'PDF' };
      }
    },
    word2pdf: {
      title: 'Word → PDF', desc: 'Convert a .docx document to PDF.', color: '#2563EB', beta: true,
      accept: '.docx', multi: false, minFiles: 1,
      options: '',
      run: async function (files, onP) {
        if (!window.mammoth) throw new Error('Converter still loading — try again in a moment.');
        onP(0.2);
        var res = await mammoth.convertToHtml({ arrayBuffer: await readAB(files[0]) });
        var holder = document.createElement('div');
        holder.style.cssText = 'width:760px;padding:48px;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;position:fixed;left:-9999px;top:0';
        holder.innerHTML = res.value || '<p>(empty document)</p>';
        document.body.appendChild(holder);
        onP(0.5);
        try {
          var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
          var pdf = new jsPDFCtor({ unit: 'pt', format: 'a4' });
          await pdf.html(holder, { autoPaging: 'text', margin: [40, 40, 40, 40], html2canvas: { scale: 0.85, useCORS: true }, width: 515, windowWidth: 760 });
          onP(1);
          return { blob: pdf.output('blob'), filename: (files[0].name.replace(/\.docx$/i, '') || 'document') + '.pdf', kind: 'PDF' };
        } finally { holder.remove(); }
      }
    },
    pdf2word: {
      title: 'PDF → Word', desc: 'Extract the text of a PDF into an editable Word (.doc) file.', color: '#0369A1', beta: true,
      accept: 'application/pdf', multi: false, minFiles: 1,
      options: '',
      run: async function (files, onP) {
        ensurePdfJs();
        var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await readAB(files[0])) }).promise;
        var html = '';
        for (var n = 1; n <= pdf.numPages; n++) {
          var page = await pdf.getPage(n);
          var tc = await page.getTextContent();
          var txt = tc.items.map(function (it) { return it.str; }).join(' ').replace(/\s+/g, ' ').trim();
          html += '<p>' + esc(txt) + '</p>';
          if (n < pdf.numPages) html += '<br style="page-break-after:always">';
          onP(n / pdf.numPages);
        }
        var doc = '<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head>' +
          '<body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5">' + (html || '<p>(no extractable text)</p>') + '</body></html>';
        return { blob: new Blob(['﻿', doc], { type: 'application/msword' }), filename: (files[0].name.replace(/\.pdf$/i, '') || 'document') + '.doc', kind: 'DOC',
          note: 'Text-focused extraction — layout and images are not preserved.' };
      }
    }
  };

  async function embedViaCanvas(out, file) {
    var url = URL.createObjectURL(file);
    try {
      var im = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = url; });
      var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      var b64 = c.toDataURL('image/png');
      return await out.embedPng(b64);
    } finally { URL.revokeObjectURL(url); }
  }

  function parseRange(str, total) {
    var out = [];
    String(str).split(',').forEach(function (part) {
      part = part.trim(); if (!part) return;
      var m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) { var a = +m[1], b = +m[2]; if (a > b) { var t = a; a = b; b = t; } for (var i = a; i <= b; i++) if (i >= 1 && i <= total) out.push(i - 1); }
      else { var n = +part; if (n >= 1 && n <= total) out.push(n - 1); }
    });
    return out.filter(function (v, i, s) { return s.indexOf(v) === i; });
  }

  /* ---------------- UI ---------------- */
  function renderGrid() {
    var g = $('toolGrid'); if (!g) return;
    g.innerHTML = Object.keys(TOOLS).map(function (id, i) {
      var t = TOOLS[id];
      return '<button class="tool-card" data-tool="' + id + '" style="--i:' + i + '; --tc:' + t.color + '">' +
        '<span class="tc-ic" style="background:' + t.color + '18; color:' + t.color + '">' + svg(ICON[id]) + '</span>' +
        '<span class="tc-body"><span class="tc-title">' + esc(t.title) + (t.beta ? ' <span class="tc-beta">beta</span>' : '') + '</span>' +
        '<span class="tc-desc">' + esc(t.desc) + '</span></span>' +
        '<span class="tc-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>' +
        '</button>';
    }).join('');
    Array.prototype.forEach.call(g.querySelectorAll('.tool-card'), function (b) {
      b.addEventListener('click', function () { openTool(b.getAttribute('data-tool')); });
    });
  }

  function openTool(id) {
    var t = TOOLS[id]; if (!t) return;
    state = { tool: id, files: [], result: null };
    $('toolGrid').style.display = 'none';
    var ws = $('workspace'); ws.style.display = 'block';
    ws.classList.remove('dt-anim'); void ws.offsetWidth; ws.classList.add('dt-anim');
    $('wsTitle').innerHTML = svg(ICON[id]) + '<span>' + esc(t.title) + (t.beta ? ' <span class="tc-beta">beta</span>' : '') + '</span>';
    $('wsDesc').textContent = t.desc;
    $('fileInput').setAttribute('accept', t.accept);
    if (t.multi) $('fileInput').setAttribute('multiple', 'multiple'); else $('fileInput').removeAttribute('multiple');
    $('dropHint').textContent = t.multi ? 'Drop files here or click to browse' : 'Drop a file here or click to browse';
    $('toolOptions').innerHTML = t.options || '';
    $('resultPanel').style.display = 'none';
    $('convertRow').style.display = 'none';
    renderFiles();
    state.orgPages = null;
  }

  function backToGrid() {
    $('workspace').style.display = 'none';
    $('toolGrid').style.display = '';
    state = { tool: null, files: [], result: null };
  }

  function addFiles(list) {
    var t = TOOLS[state.tool]; if (!t) return;
    var arr = Array.prototype.slice.call(list);
    if (!t.multi) { state.files = arr.slice(0, 1); }
    else { arr.forEach(function (f) { state.files.push(f); }); }
    $('resultPanel').style.display = 'none';
    renderFiles();
    if (t.organize && state.files.length) buildOrganize();
  }

  function removeFile(idx) { state.files.splice(idx, 1); renderFiles(); if (TOOLS[state.tool].organize) buildOrganize(); }

  function renderFiles() {
    var t = TOOLS[state.tool];
    var wrap = $('fileList');
    wrap.innerHTML = state.files.map(function (f, i) {
      var thumb = /image\//.test(f.type) ? '<img src="' + URL.createObjectURL(f) + '" alt="">' : '<span class="fc-doc">' + svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>') + '</span>';
      return '<div class="dt-file" draggable="' + (t.reorder ? 'true' : 'false') + '" data-i="' + i + '">' +
        '<span class="fc-th">' + thumb + '</span>' +
        '<span class="fc-meta"><span class="fc-name">' + esc(f.name) + '</span><span class="fc-sz">' + fmtSize(f.size) + '</span></span>' +
        (t.reorder ? '<span class="fc-drag" title="Drag to reorder"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>' : '') +
        '<button class="fc-rm" data-rm="' + i + '" title="Remove">&times;</button>' +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-rm]'), function (b) { b.addEventListener('click', function () { removeFile(+b.getAttribute('data-rm')); }); });
    if (t.reorder) wireReorder(wrap);
    var ready = state.files.length >= (t.minFiles || 1);
    $('convertRow').style.display = state.files.length ? 'flex' : 'none';
    $('convertBtn').disabled = !ready;
    $('convertBtn').querySelector('.cb-label').textContent = ready ? 'Convert' : 'Add ' + ((t.minFiles || 1) - state.files.length) + ' more file(s)';
  }

  function wireReorder(wrap) {
    var dragI = null;
    Array.prototype.forEach.call(wrap.querySelectorAll('.dt-file'), function (el) {
      el.addEventListener('dragstart', function () { dragI = +el.getAttribute('data-i'); el.classList.add('dragging'); });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
      el.addEventListener('dragover', function (e) { e.preventDefault(); });
      el.addEventListener('drop', function (e) {
        e.preventDefault(); var toI = +el.getAttribute('data-i'); if (dragI == null || dragI === toI) return;
        var m = state.files.splice(dragI, 1)[0]; state.files.splice(toI, 0, m); renderFiles();
      });
    });
  }

  /* ---- organise page grid ---- */
  async function buildOrganize() {
    var grid = $('orgGrid'); if (!grid || !state.files[0]) return;
    grid.innerHTML = '<div class="dt-loading">Loading pages…</div>';
    ensurePdfJs();
    try {
      var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await readAB(state.files[0])) }).promise;
      state.orgPages = [];
      grid.innerHTML = '';
      for (var n = 1; n <= pdf.numPages; n++) {
        var page = await pdf.getPage(n);
        var vp = page.getViewport({ scale: 0.4 });
        var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        state.orgPages.push({ i: n - 1, rot: 0, del: false });
        var cell = document.createElement('div'); cell.className = 'org-cell'; cell.dataset.k = n - 1;
        cell.appendChild(c);
        cell.insertAdjacentHTML('beforeend',
          '<div class="org-tools"><button data-act="rot" title="Rotate">⟳</button><button data-act="del" title="Delete">🗑</button></div><span class="org-num">' + n + '</span>');
        grid.appendChild(cell);
      }
      grid.addEventListener('click', onOrgClick);
    } catch (e) { grid.innerHTML = '<div class="dt-loading">Could not read this PDF.</div>'; }
  }
  function onOrgClick(e) {
    var btn = e.target.closest('button[data-act]'); if (!btn) return;
    var cell = btn.closest('.org-cell'); var k = +cell.dataset.k;
    var pageObj = state.orgPages.filter(function (p) { return p.i === k; })[0]; if (!pageObj) return;
    if (btn.getAttribute('data-act') === 'rot') { pageObj.rot = (pageObj.rot + 90) % 360; cell.querySelector('canvas').style.transform = 'rotate(' + pageObj.rot + 'deg)'; }
    else { pageObj.del = !pageObj.del; cell.classList.toggle('deleted', pageObj.del); }
  }

  /* ---------------- convert ---------------- */
  async function runConvert() {
    var t = TOOLS[state.tool]; if (!t) return;
    var btn = $('convertBtn'); btn.disabled = true; btn.classList.add('busy');
    $('progressWrap').style.display = 'block'; setProgress(0.04);
    $('resultPanel').style.display = 'none';
    try {
      var res = await t.run(state.files, setProgress);
      state.result = res;
      showResult(res);
    } catch (err) {
      if (window.showToast) showToast('Conversion failed', (err && err.message) || 'Please try a different file.', 'error');
      else alert('Conversion failed: ' + ((err && err.message) || err));
    } finally {
      btn.disabled = false; btn.classList.remove('busy');
      $('progressWrap').style.display = 'none'; setProgress(0);
    }
  }
  function setProgress(p) { var b = $('progressBar'); if (b) b.style.width = Math.round(Math.min(1, p) * 100) + '%'; }

  function showResult(res) {
    var panel = $('resultPanel');
    $('resultName').textContent = res.filename;
    $('resultMeta').textContent = fmtSize(res.blob.size) + ' · ' + res.kind + (res.note ? ' · ' + res.note : '');
    panel.style.display = 'block';
    panel.classList.remove('dt-anim'); void panel.offsetWidth; panel.classList.add('dt-anim');
    // admin-only "Add to Knowledge Center"
    var kb = $('kbBtn'); kb.style.display = 'none';
    if (window.LCData && window.LCData.isAdmin) {
      window.LCData.isAdmin().then(function (ok) { if (ok) kb.style.display = 'inline-flex'; }).catch(function () {});
    }
  }

  function download() {
    if (!state.result) return;
    var url = URL.createObjectURL(state.result.blob);
    var a = document.createElement('a'); a.href = url; a.download = state.result.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  async function addToKB() {
    if (!state.result || !window.LCData) return;
    var title = prompt('Document title for the Knowledge Center:', state.result.filename.replace(/\.[a-z0-9]+$/i, ''));
    if (!title) return;
    var kind = state.result.kind === 'DOC' ? 'Word' : state.result.kind === 'ZIP' ? 'Archive' : 'PDF';
    try {
      var row = { id: 'doc_' + Date.now(), title: title, cat: 'templates', type: kind, pages: 1,
        updated: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), views: 0,
        summary: 'Created with Document Tools. Binary is kept on your device — only this catalogue entry was saved.' };
      var res = await window.LCData.insert('documents', row);
      if (res.error) throw new Error(res.error.message);
      if (window.showToast) showToast('Added to Knowledge Center', 'A catalogue entry was created (the file stays on your device).', 'success');
    } catch (e) {
      if (window.showToast) showToast('Could not add', (e && e.message) || 'Admins only.', 'error');
    }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    renderGrid();
    $('backBtn').addEventListener('click', backToGrid);
    $('convertBtn').addEventListener('click', runConvert);
    $('downloadBtn').addEventListener('click', download);
    $('kbBtn').addEventListener('click', addToKB);
    $('startOverBtn').addEventListener('click', function () { openTool(state.tool); });

    var dz = $('dropzone'), inp = $('fileInput');
    dz.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () { if (inp.files && inp.files.length) addFiles(inp.files); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); if (ev !== 'dragleave' || e.target === dz) dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
