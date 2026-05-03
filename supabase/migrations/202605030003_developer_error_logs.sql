create table if not exists public.developer_error_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'ERROR',
  source text not null default 'CLIENT',
  message text not null,
  stack text null,
  route_path text null,
  user_id uuid null references public.users(id),
  user_email text null,
  user_role text null,
  browser_info jsonb not null default '{}'::jsonb,
  app_state jsonb not null default '{}'::jsonb,
  screenshot_url text null,
  screenshot_data text null,
  status text not null default 'OPEN',
  resolution_note text null,
  resolved_at timestamptz null,
  resolved_by uuid null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_developer_error_logs_status_created
  on public.developer_error_logs (status, created_at desc);

create index if not exists idx_developer_error_logs_user_created
  on public.developer_error_logs (user_id, created_at desc);
