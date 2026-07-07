/* ============================================================
   LYCEUM CONNECT — Frontend API client
   Thin wrapper over the Go backend (Phase 0/1). Holds the JWT,
   attaches it to requests, and degrades gracefully when the
   backend is unreachable so the static demo still works.
   ============================================================ */
(function () {
  'use strict';

  var BASE = (window.LC_API_BASE) || 'http://localhost:8090';

  function token() { return localStorage.getItem('lc-token') || ''; }

  async function req(method, path, body) {
    var res = await fetch(BASE + path, {
      method: method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token() ? { Authorization: 'Bearer ' + token() } : {}
      ),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      localStorage.removeItem('lc-token');
      localStorage.removeItem('lc-auth-session');
      if (!/\/login(\.html)?$/.test(location.pathname)) location.href = 'login.html';
      throw new Error('unauthorized');
    }
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || res.statusText);
    return data;
  }

  // Decode (not verify) the JWT payload for UI purposes: role, sub, tenant.
  function claims() {
    var t = token();
    if (!t) return null;
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }

  var LC = {
    base: BASE,
    token: token,
    claims: claims,
    setToken: function (t) { localStorage.setItem('lc-token', t); },
    clear: function () {
      localStorage.removeItem('lc-token');
      localStorage.removeItem('lc-auth-session');
    },
    get: function (p) { return req('GET', p); },
    post: function (p, b) { return req('POST', p, b); },
    patch: function (p, b) { return req('PATCH', p, b); },
    devLogin: async function (email, role, name) {
      var d = await req('POST', '/api/auth/dev-login', { email: email, role: role, name: name });
      LC.setToken(d.token);
      localStorage.setItem('lc-auth-session', 'true');
      return d;
    },
    health: async function () {
      try {
        var c = new AbortController();
        var t = setTimeout(function () { c.abort(); }, 1500);
        var r = await fetch(BASE + '/healthz', { signal: c.signal });
        clearTimeout(t);
        return r.ok;
      } catch (e) { return false; }
    },
  };

  window.LC = LC;
})();
