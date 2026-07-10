/* ============================================================
   LYCEUM CONNECT — Portal Bot chat widget (Phase 5, spec §13.5)
   A persistent, self-injecting chat launcher available on any
   page that includes this script. Talks to the grounded,
   RBAC-scoped /api/bot/ask endpoint — every answer is composed
   by the Go backend from real portal data (tool-calling), so
   ticket statuses it reports are always real, never hallucinated.
   Degrades silently when the backend is unreachable or the user
   is not signed in.
   ============================================================ */
(function () {
  'use strict';
  if (window.__lcBotMounted) return;
  window.__lcBotMounted = true;

  // The widget needs the LC API client. Most pages load js/api.js already; on the
  // few that don't, pull it in on demand so the assistant is available portal-wide.
  var selfSrc = (document.currentScript && document.currentScript.src) || 'js/bot.js';
  function ensureLC(cb) {
    if (window.LC) return cb();
    var s = document.createElement('script');
    s.src = selfSrc.replace(/bot\.js(\?.*)?$/, 'api.js');
    s.onload = cb;
    s.onerror = function () { /* no backend client — widget stays dormant */ };
    document.head.appendChild(s);
  }

  var CSS = '' +
    '#lc-bot-fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;' +
    'background:var(--primary-gradient,linear-gradient(135deg,#6D5EF6,#38BDF8));color:#fff;box-shadow:0 10px 28px rgba(79,110,247,.42);' +
    'display:flex;align-items:center;justify-content:center;z-index:9998;transition:transform .18s ease}' +
    '#lc-bot-fab:hover{transform:translateY(-2px) scale(1.04)}' +
    '#lc-bot-panel{position:fixed;right:22px;bottom:90px;width:376px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 130px);' +
    'background:var(--surface,#fff);border:1px solid var(--border,rgba(120,135,190,.16));border-radius:20px;box-shadow:0 24px 60px rgba(16,24,55,.30);' +
    'z-index:9999;display:none;flex-direction:column;overflow:hidden}' +
    '#lc-bot-panel.open{display:flex}' +
    '.lc-bot-head{padding:15px 18px;background:var(--primary-gradient,linear-gradient(135deg,#6D5EF6,#38BDF8));color:#fff;display:flex;align-items:center;gap:11px}' +
    '.lc-bot-head b{font-size:14.5px;font-weight:700;display:block}.lc-bot-head span{font-size:11.5px;opacity:.85}' +
    '.lc-bot-ava{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:17px}' +
    '.lc-bot-x{margin-left:auto;background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;opacity:.85}' +
    '.lc-bot-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--bg-secondary,#f4f6fd)}' +
    '.lc-msg{max-width:84%;padding:10px 13px;border-radius:14px;font-size:13.2px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}' +
    '.lc-msg.bot{align-self:flex-start;background:var(--surface,#fff);border:1px solid var(--border,rgba(120,135,190,.16));color:var(--text-primary,#1e2440);border-bottom-left-radius:4px}' +
    '.lc-msg.me{align-self:flex-end;background:var(--primary,#4F6EF7);color:#fff;border-bottom-right-radius:4px}' +
    '.lc-cites{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '.lc-cite{font-size:11px;text-decoration:none;padding:3px 9px;border-radius:999px;background:var(--bg-tertiary,#e9eefa);color:var(--primary,#4F6EF7);border:1px solid var(--border,rgba(120,135,190,.16))}' +
    '.lc-tool{font-size:10px;color:var(--text-secondary,#5a6685);margin-top:6px;opacity:.8}' +
    '.lc-bot-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 8px;background:var(--bg-secondary,#f4f6fd)}' +
    '.lc-bot-chip{font-size:11.5px;padding:5px 10px;border-radius:999px;background:var(--surface,#fff);border:1px solid var(--border,rgba(120,135,190,.16));color:var(--text-secondary,#5a6685);cursor:pointer}' +
    '.lc-bot-foot{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border,rgba(120,135,190,.16));background:var(--surface,#fff)}' +
    '.lc-bot-input{flex:1;height:40px;padding:0 13px;border-radius:12px;border:1px solid var(--border,rgba(120,135,190,.16));background:var(--bg-secondary,#f4f6fd);color:var(--text-primary,#1e2440);font-size:13px}' +
    '.lc-bot-send{width:40px;height:40px;border-radius:12px;border:none;background:var(--primary,#4F6EF7);color:#fff;cursor:pointer;flex-shrink:0}' +
    '.lc-bot-send:disabled{opacity:.55;cursor:default}' +
    '.lc-typing{align-self:flex-start;color:var(--text-secondary,#5a6685);font-size:12px;padding:4px 6px}';

  var CHIPS = ['What are my open requests?', 'Summarise my tasks', 'How do I submit an IT request?', 'Find the vehicle booking policy'];

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function mount() {
    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

    var fab = el('<button id="lc-bot-fab" aria-label="Open Portal Assistant" title="Portal Assistant">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>');

    var panel = el(
      '<div id="lc-bot-panel" role="dialog" aria-label="Portal Assistant">' +
        '<div class="lc-bot-head"><div class="lc-bot-ava">🤖</div><div><b>Portal Assistant</b><span id="lc-bot-eng">Grounded in your live portal data</span></div><button class="lc-bot-x" aria-label="Close">×</button></div>' +
        '<div class="lc-bot-log" id="lc-bot-log"></div>' +
        '<div class="lc-bot-chips" id="lc-bot-chips"></div>' +
        '<div class="lc-bot-foot"><input class="lc-bot-input" id="lc-bot-input" placeholder="Ask about your requests, tasks, policies…" autocomplete="off">' +
        '<button class="lc-bot-send" id="lc-bot-send" aria-label="Send">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>' +
      '</div>');

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    var log = panel.querySelector('#lc-bot-log');
    var input = panel.querySelector('#lc-bot-input');
    var sendBtn = panel.querySelector('#lc-bot-send');
    var chips = panel.querySelector('#lc-bot-chips');
    var greeted = false;

    function addMsg(text, who, cites, tools) {
      var m = el('<div class="lc-msg ' + who + '"></div>');
      m.textContent = text;
      if (cites && cites.length) {
        var wrap = document.createElement('div'); wrap.className = 'lc-cites';
        cites.forEach(function (c) {
          var a = document.createElement('a'); a.className = 'lc-cite'; a.textContent = c.label || c.ref || 'open';
          if (c.link) a.href = c.link;
          wrap.appendChild(a);
        });
        m.appendChild(wrap);
      }
      if (tools && tools.length) {
        var t = document.createElement('div'); t.className = 'lc-tool'; t.textContent = '↳ ' + tools.join(', '); m.appendChild(t);
      }
      log.appendChild(m); log.scrollTop = log.scrollHeight;
    }

    function greet() {
      if (greeted) return; greeted = true;
      if (!LC.token()) {
        addMsg('Please sign in to ask about your requests, tasks and portal policies.', 'bot');
        chips.style.display = 'none';
        return;
      }
      addMsg('Hi! I can check your requests, summarise your tasks, find Knowledge Center documents, and explain how the portal works. What would you like to know?', 'bot');
      chips.innerHTML = CHIPS.map(function (q) { return '<span class="lc-bot-chip">' + esc(q) + '</span>'; }).join('');
      Array.prototype.forEach.call(chips.querySelectorAll('.lc-bot-chip'), function (c) {
        c.addEventListener('click', function () { input.value = c.textContent; send(); });
      });
    }

    async function send() {
      var q = (input.value || '').trim();
      if (!q) return;
      if (!LC.token()) { addMsg('You need to sign in first.', 'bot'); return; }
      addMsg(q, 'me'); input.value = ''; chips.style.display = 'none';
      sendBtn.disabled = true;
      var typing = el('<div class="lc-typing">Assistant is thinking…</div>'); log.appendChild(typing); log.scrollTop = log.scrollHeight;
      try {
        var d = await LC.post('/api/bot/ask', { question: q });
        typing.remove();
        addMsg(d.text, 'bot', d.citations, d.tools);
        if (d.engine) panel.querySelector('#lc-bot-eng').textContent = d.engine === 'nim' ? 'GLM · grounded in live data' : 'Grounded in your live portal data';
      } catch (e) {
        typing.remove();
        addMsg('Sorry — I could not reach the portal backend just now.', 'bot');
      }
      sendBtn.disabled = false; input.focus();
    }

    function toggle(open) {
      panel.classList.toggle('open', open);
      if (open) { greet(); setTimeout(function () { input.focus(); }, 50); }
    }

    fab.addEventListener('click', function () { toggle(!panel.classList.contains('open')); });
    panel.querySelector('.lc-bot-x').addEventListener('click', function () { toggle(false); });
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }

  function boot() { ensureLC(mount); }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
