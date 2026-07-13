/* ============================================================
   LYCEUM CONNECT — CLIENT-SIDE AUTH GATE + SUPABASE BOOTSTRAP
   Loaded on every page. Keeps the lightweight localStorage gate
   (so all existing pages work unchanged) AND wires up the
   Supabase client + auth so real sessions drive that gate.
   ============================================================ */

'use strict';

/* ---- Supabase project config (publishable key — safe for the browser) ---- */
window.LC_SUPABASE_URL = 'https://kxxwtebxkrvdlqyljkzu.supabase.co';
window.LC_SUPABASE_KEY = 'sb_publishable_lgrEgSrErqPgUn70a5eC2A__uUa5EPx';

/* ---- Auth gate: redirect unauthenticated users to the login page ---- */
(function () {
  const sessionActive = localStorage.getItem('lc-auth-session') === 'true';
  // Match both "/login.html" and Cloudflare Pages' clean URL "/login"
  const isLoginPage = /\/login(\.html)?$/.test(window.location.pathname);

  if (!sessionActive && !isLoginPage) {
    window.location.href = 'login.html';
  } else if (sessionActive && isLoginPage) {
    window.location.href = 'index.html';
  }
})();

/* ---- Supabase client bootstrap ----
   Loads supabase-js from CDN once, builds the client, and exposes:
     window.sb              — the Supabase client (data + auth)
     window.LCAuth          — small auth helper used by the login page
     window.LCSupabaseReady — Promise<client|null>, resolves when ready
   A null resolution means the CDN was unreachable; the app then falls
   back to the Go backend / offline demo login, so nothing breaks. */
window.LCSupabaseReady = (function () {
  return new Promise(function (resolve) {
    function init() {
      if (!window.supabase || !window.supabase.createClient) { resolve(null); return; }
      var sb = window.supabase.createClient(window.LC_SUPABASE_URL, window.LC_SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.sb = sb;
      window.LCAuth = {
        client: sb,
        signIn:  function (email, password) { return sb.auth.signInWithPassword({ email: email, password: password }); },
        signUp:  function (email, password, meta) { return sb.auth.signUp({ email: email, password: password, options: { data: meta || {} } }); },
        signOut: function () { return sb.auth.signOut(); },
        session: function () { return sb.auth.getSession(); },
        user:    function () { return sb.auth.getUser(); },
        reset:   function (email) { return sb.auth.resetPasswordForEmail(email); },
        onChange:function (cb) { return sb.auth.onAuthStateChange(cb); }
      };
      // Keep the localStorage gate in sync with the real Supabase session.
      sb.auth.onAuthStateChange(function (event, session) {
        if (session) localStorage.setItem('lc-auth-session', 'true');
        else if (event === 'SIGNED_OUT') localStorage.removeItem('lc-auth-session');
      });
      resolve(sb);
    }

    if (window.supabase && window.supabase.createClient) { init(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.async = true;
    s.onload = init;
    s.onerror = function () {
      console.warn('[LC] Supabase CDN unreachable — falling back to backend/demo auth.');
      resolve(null);
    };
    document.head.appendChild(s);
  });
})();

/* Clear the session (Supabase + local gate) and return to the login page. */
function logoutSession() {
  try { if (window.sb) window.sb.auth.signOut(); } catch (e) { /* ignore */ }
  localStorage.removeItem('lc-auth-session');
  localStorage.removeItem('lc-token');
  window.location.href = 'login.html';
}

/* ---- PWA bootstrap (Phase 7) — register the service worker and offer install ---- */
(function () {
  'use strict';
  // Register the service worker (progressive enhancement; ignored if unsupported).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (e) {
        console.warn('[LC] service worker registration failed:', e && e.message);
      });
    });
  }

  // Installable? Capture the prompt and show a dismissable "Install app" chip.
  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  if (standalone || localStorage.getItem('lc-install-dismissed') === '1') return;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    var deferred = e;
    if (document.getElementById('lc-install-chip')) return;

    var chip = document.createElement('div');
    chip.id = 'lc-install-chip';
    chip.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2000;display:flex;align-items:center;gap:12px;' +
      'padding:10px 12px 10px 16px;border-radius:14px;background:#161C30;color:#EAF0FF;border:1px solid rgba(255,255,255,.14);' +
      'box-shadow:0 18px 44px -18px rgba(0,0,0,.6);font:600 13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;' +
      'animation:lcChipIn .35s cubic-bezier(.2,.7,.3,1) both';
    chip.innerHTML =
      '<span style="display:inline-flex;width:30px;height:30px;border-radius:9px;background:linear-gradient(140deg,#4F6EF7,#7C5CF0);' +
      'align-items:center;justify-content:center;flex-shrink:0">' +
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg></span>' +
      '<span>Install Lyceum Connect</span>' +
      '<button id="lc-install-go" style="height:34px;padding:0 14px;border:none;border-radius:10px;cursor:pointer;font-weight:800;color:#fff;background:linear-gradient(135deg,#4F6EF7,#7C5CF0)">Install</button>' +
      '<button id="lc-install-x" aria-label="Dismiss" style="width:30px;height:34px;border:none;border-radius:9px;cursor:pointer;background:transparent;color:rgba(234,240,255,.6);font-size:18px;line-height:1">&times;</button>';
    if (!document.getElementById('lc-chip-style')) {
      var st = document.createElement('style'); st.id = 'lc-chip-style';
      st.textContent = '@keyframes lcChipIn{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(chip);

    document.getElementById('lc-install-go').addEventListener('click', function () {
      chip.remove(); deferred.prompt();
      deferred.userChoice && deferred.userChoice.then(function () { deferred = null; });
    });
    document.getElementById('lc-install-x').addEventListener('click', function () {
      chip.remove(); try { localStorage.setItem('lc-install-dismissed', '1'); } catch (x) {}
    });
  });

  window.addEventListener('appinstalled', function () {
    var c = document.getElementById('lc-install-chip'); if (c) c.remove();
  });
})();
