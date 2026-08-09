/* ============================================================
   LYCEUM CONNECT — Meeting Recorder
   Record-first pipeline: name → record → save → transcribe.

   - Audio is captured with the browser's MediaRecorder (no API).
   - Recordings are stored as Blobs in IndexedDB, on the device.
   - Sessions are capped at 60 minutes; on reaching the cap the
     recording auto-stops, saves, and offers a fresh session (for
     when somebody forgets to press stop).
   - Transcription goes through the Supabase Edge Function
     `transcribe`, which holds the ElevenLabs key server-side.
   ============================================================ */
(function () {
  'use strict';

  var MAX_SECONDS = 60 * 60;                 // 60-minute hard cap per session
  var WARN_AT = MAX_SECONDS - 120;           // warn in the last 2 minutes
  var DB_NAME = 'lc-meetings';
  var STORE = 'recordings';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function hms(sec) { sec = Math.max(0, Math.floor(sec)); return two(Math.floor(sec / 3600)) + ':' + two(Math.floor(sec / 60) % 60) + ':' + two(sec % 60); }
  function fmtSize(n) { if (!n) return '—'; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function toast(t, m, k) { if (window.showToast) showToast(t, m, k || 'info'); }

  /* ---------------- IndexedDB ---------------- */
  function db() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), s = t.objectStore(STORE), out;
        out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  var Store = {
    all: function () { return tx('readonly', function (s) { return s.getAll(); }); },
    get: function (id) { return tx('readonly', function (s) { return s.get(id); }); },
    put: function (rec) { return tx('readwrite', function (s) { return s.put(rec); }); },
    del: function (id) { return tx('readwrite', function (s) { return s.delete(id); }); }
  };

  /* ---------------- recorder state ---------------- */
  var S = {
    rec: null, stream: null, chunks: [], mime: '',
    startedAt: 0, elapsed: 0, timer: null, state: 'idle',   // idle | recording | paused
    autoStopped: false, pendingName: '', audioCtx: null, analyser: null, rafTimer: null
  };

  function setState(next) {
    S.state = next;
    var studio = $('recStudio'); if (studio) studio.setAttribute('data-rec', next === 'recording' ? 'listening' : next === 'paused' ? 'paused' : 'idle');
    try { document.body.setAttribute('data-rec', next === 'recording' ? 'listening' : next === 'paused' ? 'paused' : 'idle'); } catch (e) {}
    var txt = $('recStatusText'), badge = $('recStatusBadge');
    if (txt) txt.textContent = next === 'recording' ? 'Recording' : next === 'paused' ? 'Paused' : 'Ready';
    if (badge) badge.className = 'status-badge' + (next === 'recording' ? ' status-active' : next === 'paused' ? ' status-pending' : '');
    var start = $('recStartBtn'), pause = $('recPauseBtn'), stop = $('recStopBtn');
    if (start) start.style.display = next === 'idle' ? 'inline-flex' : 'none';
    if (pause) { pause.style.display = next === 'idle' ? 'none' : 'inline-flex'; pause.querySelector('.lbl').textContent = next === 'paused' ? 'Resume' : 'Pause'; }
    if (stop) stop.disabled = next === 'idle';
    var name = $('recMeetingName'); if (name) name.disabled = next !== 'idle';
  }

  function paintTimer() {
    var el = $('recTimer'); if (el) el.textContent = hms(S.elapsed);
    var left = MAX_SECONDS - S.elapsed;
    var cap = $('recCapNote');
    if (cap) {
      if (S.state === 'idle') cap.textContent = 'Maximum 60 minutes per session';
      else if (left <= WARN_AT - (WARN_AT - 120)) cap.textContent = Math.max(0, Math.ceil(left / 60)) + ' min remaining of the 60-minute limit';
    }
    if (cap) cap.classList.toggle('warn', S.state !== 'idle' && S.elapsed >= WARN_AT);
  }

  function tick() {
    if (S.state !== 'recording') return;
    S.elapsed++;
    paintTimer();
    if (S.elapsed >= MAX_SECONDS) {
      S.autoStopped = true;
      stopRecording();
    }
  }

  /* ---------------- waveform ---------------- */
  function startWave(stream) {
    var canvas = $('visualizerCanvas'); if (!canvas) return;
    try {
      S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var src = S.audioCtx.createMediaStreamSource(stream);
      S.analyser = S.audioCtx.createAnalyser();
      S.analyser.fftSize = 256;
      src.connect(S.analyser);
    } catch (e) { return; }
    var ctx = canvas.getContext('2d');
    var data = new Uint8Array(S.analyser.frequencyBinCount);
    // setInterval (not rAF) so the meter keeps running when the tab is idle.
    clearInterval(S.rafTimer);
    S.rafTimer = setInterval(function () {
      if (!S.analyser) return;
      canvas.width = canvas.clientWidth || canvas.parentElement.clientWidth;
      canvas.height = 72;
      S.analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var bars = 48, step = Math.floor(data.length / bars), w = canvas.width / bars;
      for (var i = 0; i < bars; i++) {
        var v = S.state === 'recording' ? data[i * step] / 255 : 0.04;
        var h = Math.max(3, v * (canvas.height - 8));
        var g = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - h);
        g.addColorStop(0, 'rgba(239,68,68,.35)'); g.addColorStop(1, '#EF4444');
        ctx.fillStyle = S.state === 'recording' ? g : 'rgba(148,163,184,.35)';
        var x = i * w + w * 0.2, bw = w * 0.6;
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(x, canvas.height - h, bw, h, 2); ctx.fill(); }
        else ctx.fillRect(x, canvas.height - h, bw, h);
      }
    }, 60);
  }
  function stopWave() {
    clearInterval(S.rafTimer); S.rafTimer = null;
    try { if (S.audioCtx) S.audioCtx.close(); } catch (e) {}
    S.audioCtx = null; S.analyser = null;
    var canvas = $('visualizerCanvas');
    if (canvas) { var c = canvas.getContext('2d'); c && c.clearRect(0, 0, canvas.width, canvas.height); }
  }

  /* ---------------- record ---------------- */
  function pickMime() {
    var opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < opts.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(opts[i])) return opts[i];
    }
    return '';
  }

  async function startRecording() {
    var nameEl = $('recMeetingName');
    var name = (nameEl && nameEl.value || '').trim();
    if (!name) {
      // Requirement 2: the meeting must be named before recording starts.
      if (nameEl) { nameEl.classList.add('invalid'); nameEl.focus(); }
      toast('Name the meeting first', 'Enter a meeting name before you start recording.', 'error');
      return;
    }
    if (nameEl) nameEl.classList.remove('invalid');
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      toast('Recording unsupported', 'This browser cannot record audio. Try Chrome, Edge or Safari.', 'error');
      return;
    }

    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      var msg = e && e.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in your browser’s site settings and try again.'
        : 'No microphone was found.';
      toast('Cannot access microphone', msg, 'error');
      return;
    }

    S.stream = stream; S.chunks = []; S.elapsed = 0; S.autoStopped = false; S.pendingName = name;
    S.mime = pickMime();
    try {
      S.rec = S.mime ? new MediaRecorder(stream, { mimeType: S.mime }) : new MediaRecorder(stream);
    } catch (e) {
      S.rec = new MediaRecorder(stream);
    }
    S.mime = S.rec.mimeType || S.mime || 'audio/webm';

    S.rec.ondataavailable = function (e) { if (e.data && e.data.size) S.chunks.push(e.data); };
    S.rec.onstop = onRecorderStopped;
    S.rec.start(1000);                       // 1s chunks so nothing is lost on a crash
    S.startedAt = Date.now();
    setState('recording');
    paintTimer();
    clearInterval(S.timer); S.timer = setInterval(tick, 1000);
    startWave(stream);
    toast('Recording started', esc(name) + ' — up to 60 minutes.', 'success');
  }

  function togglePause() {
    if (!S.rec) return;
    if (S.state === 'recording') { S.rec.pause(); setState('paused'); }
    else if (S.state === 'paused') { S.rec.resume(); setState('recording'); }
  }

  function stopRecording() {
    if (!S.rec || S.state === 'idle') return;
    clearInterval(S.timer); S.timer = null;
    try { S.rec.stop(); } catch (e) {}
  }

  async function onRecorderStopped() {
    var wasAuto = S.autoStopped;
    var seconds = S.elapsed;
    var name = S.pendingName || 'Untitled meeting';
    var blob = new Blob(S.chunks, { type: S.mime });

    // release the mic
    try { S.stream && S.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    stopWave();
    S.rec = null; S.stream = null; S.chunks = [];
    setState('idle');
    S.elapsed = seconds; paintTimer();

    if (!blob.size) { toast('Nothing recorded', 'The recording was empty and was not saved.', 'error'); return; }

    var rec = {
      id: 'MR-' + Date.now(),
      name: name,
      createdAt: new Date().toISOString(),
      seconds: seconds,
      mime: S.mime,
      size: blob.size,
      blob: blob,
      autoStopped: wasAuto,
      transcript: '',
      transcriptAt: ''
    };
    try {
      await Store.put(rec);
      await renderList();
      toast('Recording saved', esc(name) + ' · ' + hms(seconds) + ' · ' + fmtSize(blob.size), 'success');
    } catch (e) {
      toast('Could not save', 'Storing the recording failed: ' + (e && e.message || e), 'error');
      return;
    }

    // Requirement 3: if we stopped it (not the user), offer another session.
    if (wasAuto) openAutoStopDialog(name);
    S.elapsed = 0; setTimeout(paintTimer, 1200);
  }

  /* ---------------- auto-stop dialog ---------------- */
  function openAutoStopDialog(name) {
    var ov = $('autoStopOverlay'); if (!ov) return;
    var t = $('autoStopText');
    if (t) t.innerHTML = '<b>' + esc(name) + '</b> reached the 60-minute limit, so recording stopped and the session was saved automatically.<br><br>Would you like to start another session to keep recording?';
    ov.classList.add('show');
  }
  function closeAutoStopDialog() { var ov = $('autoStopOverlay'); if (ov) ov.classList.remove('show'); }

  async function continueNextSession() {
    closeAutoStopDialog();
    var nameEl = $('recMeetingName');
    var base = (S.pendingName || '').replace(/\s*\(part\s*(\d+)\)\s*$/i, '');
    var m = (S.pendingName || '').match(/\(part\s*(\d+)\)\s*$/i);
    var next = m ? (parseInt(m[1], 10) + 1) : 2;
    if (nameEl) nameEl.value = base + ' (part ' + next + ')';
    startRecording();
  }

  /* ---------------- recordings library ---------------- */
  async function renderList() {
    var wrap = $('recList'); if (!wrap) return;
    var rows = [];
    try { rows = await Store.all(); } catch (e) { rows = []; }
    rows.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
    var count = $('recCount'); if (count) count.textContent = rows.length + (rows.length === 1 ? ' recording' : ' recordings');

    if (!rows.length) {
      wrap.innerHTML = '<div class="rec-empty"><div class="re-ic">🎙️</div><b>No recordings yet</b>' +
        '<span>Name a meeting above and hit Start recording — saved sessions appear here, ready to transcribe.</span></div>';
      return;
    }
    wrap.innerHTML = rows.map(function (r, i) {
      var done = !!r.transcript;
      return '<div class="rec-item" data-id="' + esc(r.id) + '" style="--i:' + i + '">' +
        '<span class="ri-ic">' + (done ? '📝' : '🎧') + '</span>' +
        '<div class="ri-main">' +
          '<div class="ri-name">' + esc(r.name) + (r.autoStopped ? ' <span class="ri-tag auto">auto-stopped</span>' : '') +
            (done ? ' <span class="ri-tag ok">transcribed</span>' : '') + '</div>' +
          '<div class="ri-meta">' + new Date(r.createdAt).toLocaleString() + ' · ' + hms(r.seconds) + ' · ' + fmtSize(r.size) + '</div>' +
        '</div>' +
        '<div class="ri-actions">' +
          '<button class="ri-btn" data-act="play" title="Play">▶</button>' +
          '<button class="ri-btn" data-act="dl" title="Download audio">⭳</button>' +
          '<button class="ri-btn primary" data-act="tx">' + (done ? 'View text' : 'Transcribe') + '</button>' +
          '<button class="ri-btn danger" data-act="del" title="Delete">✕</button>' +
        '</div>' +
        '<audio class="ri-audio" controls preload="none" style="display:none"></audio>' +
      '</div>';
    }).join('');
  }

  async function onListClick(e) {
    var btn = e.target.closest('.ri-btn'); if (!btn) return;
    var item = btn.closest('.rec-item'); var id = item.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    var rec = await Store.get(id); if (!rec) return;

    if (act === 'play') {
      var audio = item.querySelector('.ri-audio');
      if (audio.style.display === 'none') {
        audio.src = URL.createObjectURL(rec.blob); audio.style.display = 'block'; audio.play().catch(function () {});
      } else { audio.pause(); audio.style.display = 'none'; }
    } else if (act === 'dl') {
      var ext = /mp4/.test(rec.mime) ? 'm4a' : /ogg/.test(rec.mime) ? 'ogg' : 'webm';
      var a = document.createElement('a'); a.href = URL.createObjectURL(rec.blob);
      a.download = rec.name.replace(/[^\w\s-]/g, '') + '.' + ext;
      document.body.appendChild(a); a.click(); a.remove();
    } else if (act === 'del') {
      if (!confirm('Delete “' + rec.name + '”? The audio and any transcript will be removed from this device.')) return;
      await Store.del(id); await renderList(); toast('Deleted', 'The recording was removed.', 'info');
    } else if (act === 'tx') {
      if (rec.transcript) { showTranscript(rec); toast('Transcript loaded', rec.name, 'info'); }
      else transcribe(rec, btn);
    }
  }

  /* ---------------- transcription (ElevenLabs via edge function) ---------------- */
  function speakersToText(data) {
    var words = data && data.words;
    if (!words || !words.length) return (data && data.text) || '';
    var out = [], cur = null;
    words.forEach(function (w) {
      if (w.type === 'audio_event') return;
      var sp = w.speaker_id || 'speaker_0';
      if (!cur || cur.sp !== sp) { cur = { sp: sp, text: '' }; out.push(cur); }
      cur.text += (w.type === 'spacing' ? (w.text || ' ') : (w.text || ''));
    });
    var label = {}, n = 0;
    return out.map(function (b) {
      if (!label[b.sp]) { n++; label[b.sp] = 'Speaker ' + n; }
      return '<p><span class="spk-chip">' + esc(label[b.sp]) + '</span>' + esc(b.text.trim()) + '</p>';
    }).join('');
  }

  async function transcribe(rec, btn) {
    var sb = await (window.LCSupabaseReady || Promise.resolve(null));
    if (!sb) { toast('Offline', 'Transcription needs a connection to the portal service.', 'error'); return; }
    var sess = await sb.auth.getSession();
    if (!sess || !sess.data || !sess.data.session) {
      toast('Sign in required', 'Transcription runs through your portal account — please sign in with Supabase first.', 'error');
      return;
    }

    var old = btn.textContent; btn.disabled = true; btn.textContent = 'Transcribing…';
    var box = $('transcriptEditor');
    if (box) box.innerHTML = '<p class="placeholder-text">Transcribing “' + esc(rec.name) + '” with ElevenLabs… this usually takes well under a minute.</p>';

    try {
      var ext = /mp4/.test(rec.mime) ? 'm4a' : /ogg/.test(rec.mime) ? 'ogg' : 'webm';
      var fd = new FormData();
      fd.append('file', new File([rec.blob], 'meeting.' + ext, { type: rec.mime }));
      fd.append('model_id', 'scribe_v1');
      var langSel = $('recLanguage');
      if (langSel && langSel.value && langSel.value !== 'auto') fd.append('language_code', langSel.value);

      var r = await sb.functions.invoke('transcribe', { body: fd });
      if (r.error) {
        var detail = '';
        try { detail = (await r.error.context.json()).detail || (await r.error.context.json()).error; } catch (x) { detail = r.error.message; }
        throw new Error(detail || r.error.message || 'Transcription failed');
      }
      var data = r.data || {};
      var html = speakersToText(data) || '<p>' + esc(data.text || '') + '</p>';
      rec.transcript = html;
      rec.transcriptAt = new Date().toISOString();
      rec.language = data.language_code || '';
      await Store.put(rec);
      await renderList();
      showTranscript(rec);
      toast('Transcript ready', esc(rec.name) + ' transcribed successfully.', 'success');
    } catch (e) {
      var msg = (e && e.message) || String(e);
      if (/not configured/i.test(msg)) {
        msg = 'The ElevenLabs key has not been set yet. Add the ELEVENLABS_API_KEY secret and deploy the transcribe function.';
      }
      if (box) box.innerHTML = '<p class="placeholder-text">Transcription failed. ' + esc(msg) + '</p>';
      toast('Transcription failed', msg, 'error');
    } finally { btn.disabled = false; btn.textContent = old; }
  }

  function showTranscript(rec) {
    var box = $('transcriptEditor');
    if (box) box.innerHTML = rec.transcript || '<p class="placeholder-text">No transcript yet.</p>';
    var t = $('activeMeetingLabel');
    if (t) t.textContent = rec.name + ' · ' + hms(rec.seconds);
    var title = $('meetingTitle'); if (title && !title.value) title.value = rec.name;
    window.LC_ACTIVE_RECORDING = rec.id;
    var panel = $('transcriptPanel'); if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (!$('recStudio')) return;                 // not on this page
    setState('idle'); paintTimer(); renderList();

    $('recStartBtn').addEventListener('click', startRecording);
    $('recPauseBtn').addEventListener('click', togglePause);
    $('recStopBtn').addEventListener('click', function () { S.autoStopped = false; stopRecording(); });
    $('recList').addEventListener('click', onListClick);

    var nameEl = $('recMeetingName');
    if (nameEl) nameEl.addEventListener('input', function () { nameEl.classList.remove('invalid'); });

    var yes = $('autoStopYes'), no = $('autoStopNo');
    if (yes) yes.addEventListener('click', continueNextSession);
    if (no) no.addEventListener('click', closeAutoStopDialog);

    // Don't let a tab close silently bin an in-progress recording.
    window.addEventListener('beforeunload', function (e) {
      if (S.state !== 'idle') { e.preventDefault(); e.returnValue = ''; }
    });

    window.LCRec = { Store: Store, list: renderList, MAX_SECONDS: MAX_SECONDS, state: function () { return S.state; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
