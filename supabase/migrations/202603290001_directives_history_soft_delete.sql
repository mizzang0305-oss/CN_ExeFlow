create extension if not exists pgcrypto;

alter table public.directive_logs
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null references public.users(id),
  add column if not exists delete_reason text null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.directives
  add column if not exists is_urgent boolean not null default false,
  add column if not exists urgent_level int null check (urgent_level between 1 and 3);

update public.directive_logs
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid not null references public.users(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_directive_logs_is_deleted
  on public.directive_logs (directive_id, is_deleted);

create index if not exists idx_directives_urgent
  on public.directives (is_urgent, urgent_level desc, due_date asc);

create index if not exists idx_history_entity
  on public.history (entity_type, entity_id, created_at desc);

comment on table public.history is 'Application-level history records for directives and directive logs.';

insert into storage.buckets (id, name, public)
values ('directive-evidence', 'directive-evidence', false)
on conflict (id) do nothing;
