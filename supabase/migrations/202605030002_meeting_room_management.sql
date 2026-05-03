alter table public.meeting_records
  add column if not exists deleted_at timestamptz null;

alter table public.meeting_records
  add column if not exists deleted_by uuid null references public.users(id);

alter table public.meeting_records
  add column if not exists updated_at timestamptz not null default now();

alter table public.meeting_records
  add column if not exists meeting_type text not null default 'ETC';

alter table public.meeting_records
  add column if not exists file_url text null;

alter table public.meeting_records
  add column if not exists file_name text null;

create index if not exists idx_meeting_records_visible_type_date
  on public.meeting_records (meeting_type, meeting_date desc, created_at desc)
  where is_deleted = false;

create index if not exists idx_meeting_records_visible_date
  on public.meeting_records (meeting_date desc, created_at desc)
  where is_deleted = false;
