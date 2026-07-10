-- ============================================================
-- Lyceum Connect — core portal schema (Supabase / Postgres)
-- Run in the Supabase SQL editor (Dashboard → SQL → New query).
-- Idempotent: safe to re-run.
--
-- Tables: profiles, employees, announcements
-- Security: RLS on. Signed-in (authenticated) users can READ.
--           Writes are limited to admins (see is_admin()).
-- ============================================================

-- ---------- helpers ----------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------- profiles (one row per auth user) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'employee',   -- employee | company_admin | group_super_admin | ...
  department  text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin check used by write policies.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('company_admin', 'group_super_admin')
  );
$$;

-- ---------- employees (directory) ----------
create table if not exists public.employees (
  id            text primary key,               -- e.g. emp_001
  name          text not null,
  designation   text,
  department    text,
  function      text,
  category      text,                            -- Management | Non-Management
  emp_code      text,
  joining_date  text,
  email         text,
  phone         text,
  location      text,
  reports_to    text,
  tags          text[] default '{}',
  hue           int  default 220,
  online        boolean default false,
  created_at    timestamptz not null default now()
);

-- ---------- announcements ----------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text default 'circular',          -- hr | it | facility | event | achievement | circular
  priority     text,                             -- 'Urgent' renders with a red badge
  body         text,
  author_name  text default 'Group Communications',
  published    boolean default true,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.employees     enable row level security;
alter table public.announcements enable row level security;

-- profiles: a user sees & edits their own row; admins see all.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid());

-- employees: any signed-in user can read; only admins write.
drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees
  for select to authenticated using (true);

drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- announcements: signed-in read (published only); admins write.
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements
  for select to authenticated using (published = true or public.is_admin());

drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Seed data (skipped on re-run via ON CONFLICT / guards)
-- ============================================================
insert into public.announcements (title, category, priority, body, author_name, created_at) values
  ('IT System Maintenance — Saturday Window', 'it', 'Urgent',
   'The Group IT Infrastructure department has scheduled a maintenance window this Saturday from 11:00 PM until 03:00 AM. Core network services, email forwarding, and portal access will be offline during this period. We apologize for any inconvenience.',
   'IT Infrastructure', now() - interval '1 day'),
  ('New Medical Insurance Policy Effective Next Month', 'hr', null,
   'The Group HR Board has signed the new health benefits tier policy. All staff will be enrolled in the Premium Care tier, featuring lower copays, wider network hospitals, and dental cover. Information booklets follow next week.',
   'HR Welfare Board', now() - interval '3 days'),
  ('Fire Drill Scheduled', 'facility', null,
   'In coordination with Civil Defense, the HQ facilities team will conduct a mandatory fire drill next Tuesday at 10:00 AM. Please review evacuation points and proceed to the designated muster zones immediately when alarms ring.',
   'Facilities Management', now() - interval '4 days'),
  ('Welcome to Lyceum Connect Portal', 'circular', null,
   'We are thrilled to present Lyceum Connect, our unified digital workplace. Request letters and IT hardware, book rooms, explore the directory, and track dashboards — all in one place. Share feedback anytime via Lexi.',
   'Group Communications', now() - interval '6 days'),
  ('Staff Excellence Awards — Winners Announced', 'achievement', null,
   'Join us in congratulating this month''s Staff Excellence Award winners for their outstanding contributions across Finance and Facilities. Thank you for your dedication and hard work!',
   'Executive Office', now() - interval '8 days')
on conflict do nothing;

-- A small seed roster (the front-end still generates extras locally as fallback).
insert into public.employees (id, name, designation, department, function, category, emp_code, joining_date, email, phone, location, reports_to, tags, hue, online) values
  ('emp_001','Dilan Bell','Backend Developer','Engineering','Platform','Non-Management','EMP-2022-1001','12-Mar-2022','dilan.bell@lyceum.edu','+968 2410 4521','HQ — Main Building','Department Head','{Developer,Non-Management}',210,true),
  ('emp_002','Priya Sharma','Engineering Manager','Engineering','Platform','Management','EMP-2021-1002','04-Jun-2021','priya.sharma@lyceum.edu','+968 2412 8830','HQ — Block A, Floor 2','Office of the CEO','{Developer,Management}',280,false),
  ('emp_003','Ahmed Al-Rashid','DevOps Engineer','Engineering','Infrastructure','Management','EMP-2020-1003','19-Sep-2020','ahmed.alrashid@lyceum.edu','+968 2419 4410','Campus A','Office of the CEO','{Developer,Management}',150,true),
  ('emp_004','Fatima Al-Hassan','Finance Director','Finance','Accounting','Management','EMP-2020-1004','01-Feb-2020','fatima.alhassan@lyceum.edu','+968 2411 2200','HQ — Main Building','Office of the CEO','{Finance,Management}',330,false),
  ('emp_005','Carlos Mendez','Operations Lead','Operations','Delivery','Management','EMP-2021-1005','23-Jul-2021','carlos.mendez@lyceum.edu','+968 2413 7788','Campus B','Office of the CEO','{Operations,Management}',30,true),
  ('emp_006','Noor Abdullah','HR Business Partner','Human Resources','People Ops','Management','EMP-2022-1006','15-Apr-2022','noor.abdullah@lyceum.edu','+968 2414 6655','HQ — Main Building','Department Head','{HR,Management}',190,false),
  ('emp_007','Mei Chen','Product Designer','Design','Product','Non-Management','EMP-2023-1007','08-Jan-2023','mei.chen@lyceum.edu','+968 2415 9911','Remote','Department Head','{Designer,Non-Management}',260,true),
  ('emp_008','Kofi Okafor','Marketing Manager','Marketing','Growth','Management','EMP-2021-1008','30-Oct-2021','kofi.okafor@lyceum.edu','+968 2416 3322','HQ — Block A, Floor 2','Office of the CEO','{Marketing,Management}',95,false),
  ('emp_009','Elena Rossi','Data Analyst','Operations','Analytics','Non-Management','EMP-2023-1009','11-May-2023','elena.rossi@lyceum.edu','+968 2417 1144','Campus A','Department Head','{Analyst,Non-Management}',300,true),
  ('emp_010','Ravi Patel','Network Engineer','Information Technology','Infrastructure','Non-Management','EMP-2022-1010','27-Aug-2022','ravi.patel@lyceum.edu','+968 2418 5566','HQ — Main Building','Department Head','{IT,Non-Management}',170,false)
on conflict (id) do nothing;
