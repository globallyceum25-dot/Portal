/* ============================================================
   LYCEUM CONNECT — Supabase data access (window.LCData)
   Thin read layer over the Supabase tables from
   supabase/migrations/0001_portal_core.sql.

   Every getter returns { rows, source } where source is
   'supabase' | 'fallback'. Callers pass a fallback so the UI
   keeps working before the tables exist or when the visitor
   isn't signed in with a real Supabase session.
   ============================================================ */
(function () {
  'use strict';

  // Resolve the Supabase client, or null if unavailable.
  async function client() {
    try { return await window.LCSupabaseReady; } catch (e) { return null; }
  }

  // Only query when we actually have an authenticated session — the RLS
  // policies require `authenticated`, so anon reads would just error out.
  async function authed(sb) {
    if (!sb) return false;
    try {
      var r = await sb.auth.getSession();
      return !!(r && r.data && r.data.session);
    } catch (e) { return false; }
  }

  async function fetchRows(table, build) {
    var sb = await client();
    if (!(await authed(sb))) return null;         // signal caller to use fallback
    var q = sb.from(table).select('*');
    if (build) q = build(q);
    var res = await q;
    if (res.error) { console.warn('[LCData] ' + table + ':', res.error.message); return null; }
    return res.data || [];
  }

  var LCData = {
    // Is a live Supabase session driving the data?
    live: async function () { return authed(await client()); },

    // employees: newest-friendly order not needed; keep id order.
    employees: async function (fallback) {
      var rows = await fetchRows('employees', function (q) { return q.order('id', { ascending: true }); });
      if (rows && rows.length) return { rows: rows, source: 'supabase' };
      return { rows: fallback || [], source: 'fallback' };
    },

    // announcements: newest first. Returns raw table rows; caller maps shape.
    announcements: async function (fallback) {
      var rows = await fetchRows('announcements', function (q) {
        return q.eq('published', true).order('created_at', { ascending: false });
      });
      if (rows && rows.length) return { rows: rows, source: 'supabase' };
      return { rows: fallback || [], source: 'fallback' };
    }
  };

  window.LCData = LCData;
})();
