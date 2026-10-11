create table if not exists public.medical_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  full_name text not null default '',
  rut text not null default '',
  diabetes boolean not null default false,
  hypertension boolean not null default false,
  allergies text not null default '',
  medications text not null default '',
  blood_type text not null default '',
  emergency_contact text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  strength text not null default '',
  dosage text not null default '',
  instructions text not null default '',
  notes text not null default '',
  times text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  provider text not null default '',
  location text not null default '',
  instructions text not null default '',
  phone text not null default '',
  starts_at timestamptz not null,
  reminder_minutes integer not null default 60 check (reminder_minutes between 0 and 10080),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null check (status in ('taken', 'skipped')),
  taken_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists medications_user_active_idx
  on public.medications (user_id, active, created_at);
create index if not exists appointments_user_starts_idx
  on public.appointments (user_id, starts_at);
create index if not exists medication_doses_user_schedule_idx
  on public.medication_doses (user_id, scheduled_for);
create unique index if not exists medication_doses_unique_schedule_idx
  on public.medication_doses (user_id, medication_id, scheduled_for);

alter table public.medical_profiles enable row level security;
alter table public.medications enable row level security;
alter table public.appointments enable row level security;
alter table public.medication_doses enable row level security;

drop policy if exists "Users manage their medical profile" on public.medical_profiles;
create policy "Users manage their medical profile"
  on public.medical_profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their medications" on public.medications;
create policy "Users manage their medications"
  on public.medications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their appointments" on public.appointments;
create policy "Users manage their appointments"
  on public.appointments for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their medication doses" on public.medication_doses;
create policy "Users manage their medication doses"
  on public.medication_doses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.medications
      where medications.id = medication_doses.medication_id
        and medications.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on
  public.medical_profiles, public.medications, public.appointments, public.medication_doses
  to authenticated;
