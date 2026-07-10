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
