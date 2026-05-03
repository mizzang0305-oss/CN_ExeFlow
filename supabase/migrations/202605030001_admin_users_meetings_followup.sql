alter table public.users
  add column if not exists must_change_password boolean not null default false;

alter table public.users
  add column if not exists initial_password_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.meeting_records (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  meeting_type text not null,
  title text not null,
  content text not null,
  uploaded_file_url text null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create table if not exists public.meeting_directive_drafts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meeting_records(id) on delete cascade,
  title text not null,
  content text not null,
  recommended_departments jsonb not null default '[]'::jsonb,
  selected_department_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'DRAFT',
  is_selected boolean not null default true,
  is_urgent boolean not null default false,
  urgent_level text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_records_created_by_date
  on public.meeting_records (created_by, meeting_date desc, created_at desc)
  where is_deleted = false;

create index if not exists idx_meeting_directive_drafts_meeting_selected
  on public.meeting_directive_drafts (meeting_id, is_selected, created_at);

insert into storage.buckets (id, name, public)
values ('meeting-attachments', 'meeting-attachments', false)
on conflict (id) do nothing;
