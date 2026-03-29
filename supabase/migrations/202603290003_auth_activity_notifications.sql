create extension if not exists pgcrypto;

alter table public.users
  add column if not exists auth_user_id uuid null,
  add column if not exists last_login_at timestamptz null,
  add column if not exists last_active_at timestamptz null;

do $$
begin
  begin
    alter table public.users
      add constraint users_auth_user_id_unique unique (auth_user_id);
  exception
    when duplicate_object then null;
  end;
end $$;

create index if not exists idx_users_auth_user_id
  on public.users (auth_user_id);

create index if not exists idx_users_email_lower
  on public.users (lower(email));

create table if not exists public.auth_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.users(id),
  email text null,
  event_type text not null,
  event_result text not null,
  ip_address text null,
  user_agent text null,
  device_type text null,
  platform text null,
  happened_at timestamptz not null default now()
);

create index if not exists idx_auth_activity_logs_user_happened
  on public.auth_activity_logs (user_id, happened_at desc);

create index if not exists idx_auth_activity_logs_email_happened
  on public.auth_activity_logs (email, happened_at desc);

create index if not exists idx_auth_activity_logs_event_happened
  on public.auth_activity_logs (event_type, happened_at desc);

create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  department_id uuid null references public.departments(id),
  activity_type text not null,
  page_path text null,
  target_type text null,
  target_id text null,
  metadata jsonb not null default '{}'::jsonb,
  happened_at timestamptz not null default now()
);

create index if not exists idx_user_activity_logs_user_happened
  on public.user_activity_logs (user_id, happened_at desc);

create index if not exists idx_user_activity_logs_department_happened
  on public.user_activity_logs (department_id, happened_at desc);

create index if not exists idx_user_activity_logs_activity_happened
  on public.user_activity_logs (activity_type, happened_at desc);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  device_key text not null,
  platform text not null,
  push_token text null,
  device_type text not null,
  notification_permission text not null default 'default',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_devices_user_device_key
  on public.user_devices (user_id, device_key);

create index if not exists idx_user_devices_user_seen
  on public.user_devices (user_id, last_seen_at desc);

create unique index if not exists idx_user_devices_push_token
  on public.user_devices (push_token)
  where push_token is not null;

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  directive_id uuid null references public.directives(id),
  notification_type text not null,
  channel text not null,
  title text not null,
  body text not null,
  delivery_status text not null default 'PENDING',
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  clicked_at timestamptz null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_logs_user_sent
  on public.notification_logs (user_id, sent_at desc);

create index if not exists idx_notification_logs_directive_sent
  on public.notification_logs (directive_id, sent_at desc);

create index if not exists idx_notification_logs_delivery
  on public.notification_logs (delivery_status, sent_at desc);

create or replace function public.set_user_devices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_devices_updated_at on public.user_devices;

create trigger trg_user_devices_updated_at
before update on public.user_devices
for each row
execute function public.set_user_devices_updated_at();

comment on column public.users.auth_user_id is 'Supabase Auth 사용자와 public.users를 연결하는 키';
comment on table public.auth_activity_logs is '로그인, 로그아웃, 세션 만료 등 인증 이벤트 감사 로그';
comment on table public.user_activity_logs is '주요 화면 진입 및 실행 행동 감사 로그';
comment on table public.user_devices is '사용자별 디바이스 및 푸시 토큰 상태';
comment on table public.notification_logs is '푸시/알림 발송 및 열람 이력';
