-- ============================================================
-- Lyceum Connect — ops schema (tasks, requests, documents)
-- Run AFTER 0001_portal_core.sql. Idempotent: safe to re-run.
--
-- tasks / requests: collaborative — any signed-in user reads & writes.
-- documents:        signed-in read; admin write (is_admin() from 0001).
-- ============================================================

-- ---------- security fix: stop users self-promoting their role ----------
-- 0001's profiles_update_self policy lets a user edit their own row; without
-- this guard they could set role='group_super_admin'. Only admins may change role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_role on public.profiles;
create trigger protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- tasks ----------
create table if not exists public.tasks (
  id            text primary key,
  title         text not null,
  assignee      text,
  due_date      date,
  priority      text default 'Medium',            -- High | Medium | Low
  completed     boolean default false,
  meeting_title text,
  owner_id      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------- requests ----------
create table if not exists public.requests (
  id             text primary key,
  service        text not null,
  cat            text,                             -- IT | HR | Admin | FM ...
  priority       text default 'medium',            -- high | medium | low
  status         text default 'open',              -- open | pending | inprogress | completed
  created        text,
  sla            text,
  sla_overdue    boolean default false,
  assigned_to    text,
  assigned_dept  text,
  requestor      text,
  requestor_dept text,
  sla_pct        int default 0,
  comments       jsonb default '[]'::jsonb,
  timeline       jsonb default '[]'::jsonb,
  owner_id       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------- documents (knowledge centre catalogue) ----------
create table if not exists public.documents (
  id          text primary key,
  title       text not null,
  cat         text,                                -- hr-policies | it-policies | operations | finance | legal | templates
  type        text default 'PDF',
  pages       int default 1,
  updated     text,
  views       int default 0,
  featured    boolean default false,
  icon        text default '📄',
  summary     text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.tasks     enable row level security;
alter table public.requests  enable row level security;
alter table public.documents enable row level security;

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks
  for all to authenticated using (true) with check (true);

drop policy if exists requests_all on public.requests;
create policy requests_all on public.requests
  for all to authenticated using (true) with check (true);

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select to authenticated using (true);

drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Seed data
-- ============================================================
insert into public.tasks (id, title, assignee, due_date, priority, completed, meeting_title) values
  ('TSK-SEED-001','Prepare revised Q3 budget projection with updated enrollment figures','Lisa Thompson','2026-06-12','High',false,'Q3 Budget Review — June 3'),
  ('TSK-SEED-002','Submit capital expenditure approval form for new campus servers','Raj Patel','2026-06-10','High',true,'Q3 Budget Review — June 3'),
  ('TSK-SEED-003','Consolidate department spend reports and share with finance team','Sudaraka Perera','2026-06-14','Medium',false,'Q3 Budget Review — June 3'),
  ('TSK-SEED-004','Schedule follow-up meeting with procurement for vendor renegotiation','Lisa Thompson','2026-06-09','Low',true,'Q3 Budget Review — June 3'),
  ('TSK-SEED-005','Audit current network bandwidth across all campus locations','James Wilson','2026-06-15','High',false,'IT Infrastructure Planning — June 5'),
  ('TSK-SEED-006','Draft RFP for cloud migration of legacy student records system','Raj Patel','2026-06-18','High',false,'IT Infrastructure Planning — June 5')
on conflict (id) do nothing;

insert into public.requests (id, service, cat, priority, status, created, sla, sla_overdue, assigned_to, assigned_dept, requestor, requestor_dept, sla_pct, comments, timeline) values
  ('REQ-2025-047','IT Support - Laptop Overheating','IT','high','inprogress','28 May 2025','29 May 2025',true,'Mark Johnson','IT Support','Sudaraka Perera','IT Governance',95,
    '[{"initials":"MJ","name":"Mark Johnson","time":"28 May, 10:42 AM","text":"Ticket received and assigned. Reviewing hardware diagnostics."}]'::jsonb,
    '[{"label":"Submitted","time":"28 May 2025, 09:30 AM","desc":"Request submitted via Service Portal","state":"done"},{"label":"In Progress","time":"28 May 2025, 10:42 AM","desc":"Assigned to Mark Johnson","state":"active"},{"label":"Completed","time":"—","desc":"Pending resolution","state":"pending"}]'::jsonb),
  ('REQ-2025-046','Service Letter Request','HR','medium','pending','27 May 2025','30 May 2025',false,'Fatima Al-Rashid','HR Department','Sudaraka Perera','IT Governance',45,
    '[{"initials":"FA","name":"Fatima Al-Rashid","time":"27 May, 2:15 PM","text":"Request received. Pending line manager approval."}]'::jsonb,
    '[{"label":"Submitted","time":"27 May 2025, 01:20 PM","desc":"Submitted via Service Portal","state":"done"},{"label":"Approved","time":"—","desc":"Awaiting line manager approval","state":"active"},{"label":"Completed","time":"—","desc":"Pending","state":"pending"}]'::jsonb),
  ('REQ-2025-045','Company Vehicle Booking - VIP Shuttle','Admin','low','completed','25 May 2025','25 May 2025',false,'Omar Hassan','Admin & Facilities','Sudaraka Perera','IT Governance',100,
    '[{"initials":"OH","name":"Omar Hassan","time":"25 May, 08:55 AM","text":"Shuttle vehicle booking confirmed."}]'::jsonb,
    '[{"label":"Submitted","time":"25 May 2025, 08:00 AM","desc":"Booking request submitted","state":"done"},{"label":"Completed","time":"25 May 2025, 01:00 PM","desc":"Transport completed","state":"done"}]'::jsonb)
on conflict (id) do nothing;

insert into public.documents (id, title, cat, type, pages, updated, views, featured, icon, summary) values
  ('emp-handbook','Employee Handbook 2025','hr-policies','PDF',124,'Jan 2025',2150,true,'📘','The complete guide to working at Lyceum — policies, benefits, and expectations.'),
  ('annual-leave','Annual Leave Policy','hr-policies','PDF',15,'Dec 2024',1240,false,'📄','Entitlements, accrual, and the process for requesting annual leave.'),
  ('code-conduct','Code of Conduct','hr-policies','PDF',24,'Feb 2025',2150,false,'📄','Standards of professional behaviour expected of all staff.'),
  ('it-security','IT Security Policy v3','it-policies','PDF',48,'Mar 2025',1890,true,'🛡️','Security controls, access management, and incident response procedures.'),
  ('password','Password Management Policy','it-policies','PDF',6,'Mar 2025',2340,false,'📄','Rules for strong passwords, rotation, and the password manager.'),
  ('remote-work','Remote Work Guidelines','it-policies','PDF',10,'Jan 2025',1120,false,'📄','Expectations and tooling for hybrid and remote working.'),
  ('hs-manual','Health & Safety Manual','operations','PDF',96,'Feb 2025',1120,true,'🏥','Workplace safety, emergency procedures, and reporting.'),
  ('bcp','Business Continuity Plan','operations','PDF',22,'Dec 2024',388,false,'📄','How the organisation maintains operations during disruption.'),
  ('travel-expense','Travel & Expense Policy','finance','PDF',18,'Jan 2025',543,false,'📄','Booking travel and claiming reimbursable expenses.'),
  ('leave-form','Leave Application Form','templates','Word',1,'Jan 2025',3210,false,'📝','Standard form to request leave.')
on conflict (id) do nothing;
