/* ============================================================
   LYCEUM CONNECT — Supabase data access (window.LCData)
   Read/write layer over the tables in
   supabase/migrations/0001_portal_core.sql + 0002_portal_ops.sql.

   Read getters return { rows, source } where source is
   'supabase' | 'fallback'. Callers pass a fallback so the UI keeps
   working before the tables exist or when the visitor isn't signed
   in with a real Supabase session.

   Write helpers (insert/update + create*) require an authenticated
   session and resolve to { data, error }.
   ============================================================ */
(function () {
  'use strict';

  async function client() {
    try { return await window.LCSupabaseReady; } catch (e) { return null; }
  }

  // RLS requires `authenticated`, so only query with a real session.
  async function authed(sb) {
    if (!sb) return false;
    try {
      var r = await sb.auth.getSession();
      return !!(r && r.data && r.data.session);
    } catch (e) { return false; }
  }

  async function fetchRows(table, build) {
    var sb = await client();
    if (!(await authed(sb))) return null;          // signal caller to use fallback
    var q = sb.from(table).select('*');
    if (build) q = build(q);
    var res = await q;
    if (res.error) { console.warn('[LCData] ' + table + ':', res.error.message); return null; }
    return res.data || [];
  }

  function pick(rows, source) { return { rows: rows, source: source }; }

  // ---- shape mappers (DB snake_case → app camelCase) ----
  function mapTask(t) {
    return { id: t.id, title: t.title, assignee: t.assignee, dueDate: t.due_date,
      priority: t.priority, completed: !!t.completed, meetingTitle: t.meeting_title,
      dateCreated: t.created_at ? new Date(t.created_at).toLocaleDateString('en-US') : '' };
  }
  function mapRequest(r) {
    return { id: r.id, service: r.service, cat: r.cat, priority: r.priority, status: r.status,
      created: r.created, sla: r.sla, slaOverdue: !!r.sla_overdue, assignedTo: r.assigned_to,
      assignedDept: r.assigned_dept, requestor: r.requestor, requestorDept: r.requestor_dept,
      slaPct: r.sla_pct, comments: r.comments || [], timeline: r.timeline || [] };
  }

  var LCData = {
    live: async function () { return authed(await client()); },

    // Role of the signed-in user (from profiles), or null.
    role: async function () {
      var sb = await client();
      if (!(await authed(sb))) return null;
      try {
        var u = await sb.auth.getUser();
        var uid = u && u.data && u.data.user && u.data.user.id;
        if (!uid) return null;
        var res = await sb.from('profiles').select('role').eq('id', uid).single();
        return res.error ? null : (res.data && res.data.role) || null;
      } catch (e) { return null; }
    },
    isAdmin: async function () {
      var role = await LCData.role();
      return role === 'company_admin' || role === 'group_super_admin';
    },

    // ---- reads ----
    employees: async function (fallback) {
      var rows = await fetchRows('employees', function (q) { return q.order('id', { ascending: true }); });
      if (rows && rows.length) return pick(rows, 'supabase');
      return pick(fallback || [], 'fallback');
    },
    announcements: async function (fallback) {
      var rows = await fetchRows('announcements', function (q) {
        return q.eq('published', true).order('created_at', { ascending: false });
      });
      if (rows && rows.length) return pick(rows, 'supabase');
      return pick(fallback || [], 'fallback');
    },
    tasks: async function (fallback) {
      var rows = await fetchRows('tasks', function (q) { return q.order('created_at', { ascending: true }); });
      if (rows && rows.length) return pick(rows.map(mapTask), 'supabase');
      return pick(fallback || [], 'fallback');
    },
    requests: async function (fallback) {
      var rows = await fetchRows('requests', function (q) { return q.order('created_at', { ascending: false }); });
      if (rows && rows.length) return pick(rows.map(mapRequest), 'supabase');
      return pick(fallback || [], 'fallback');
    },
    documents: async function (fallback) {
      var rows = await fetchRows('documents', function (q) { return q.order('title', { ascending: true }); });
      if (rows && rows.length) return pick(rows, 'supabase');
      return pick(fallback || [], 'fallback');
    },

    // ---- writes (need a session; RLS enforces who can write) ----
    insert: async function (table, row) {
      var sb = await client();
      if (!(await authed(sb))) return { data: null, error: { message: 'Not signed in' } };
      return sb.from(table).insert(row).select().single();
    },
    update: async function (table, id, patch) {
      var sb = await client();
      if (!(await authed(sb))) return { data: null, error: { message: 'Not signed in' } };
      return sb.from(table).update(patch).eq('id', id).select().single();
    },

    // Convenience creators.
    createAnnouncement: function (row) { return LCData.insert('announcements', row); },
    createEmployee: function (row) { return LCData.insert('employees', row); },
    createTask: function (row) { return LCData.insert('tasks', row); }
  };

  window.LCData = LCData;
})();
