alter table public.user_devices
  add column if not exists browser_name text null,
  add column if not exists app_version text null,
  add column if not exists is_active boolean not null default true;

alter table public.notification_logs
  add column if not exists directive_department_id uuid null references public.directive_departments(id),
  add column if not exists payload jsonb not null default '{}'::jsonb;

update public.notification_logs
set channel = 'WEB_PUSH'
where channel = 'PUSH';

update public.notification_logs
set notification_type = 'APPROVAL_REQUIRED'
where notification_type = 'APPROVAL_REQUESTED';

update public.notification_logs
set notification_type = 'APPROVED'
where notification_type = 'APPROVAL_COMPLETED';

update public.notification_logs
set notification_type = 'REJECTED'
where notification_type = 'DIRECTIVE_REJECTED';

update public.notification_logs
set notification_type = 'DELAY_WARNING'
where notification_type = 'DIRECTIVE_DELAYED';

update public.notification_logs
set payload = coalesce(metadata, '{}'::jsonb)
where payload = '{}'::jsonb;

create index if not exists idx_notification_logs_user_unread
  on public.notification_logs (user_id, sent_at desc)
  where read_at is null;

create index if not exists idx_notification_logs_user_read
  on public.notification_logs (user_id, read_at, sent_at desc);

create index if not exists idx_notification_logs_type_sent
  on public.notification_logs (notification_type, sent_at desc);

create index if not exists idx_notification_logs_channel_sent
  on public.notification_logs (channel, sent_at desc);

create index if not exists idx_notification_logs_directive_department_sent
  on public.notification_logs (directive_department_id, sent_at desc);

comment on column public.user_devices.browser_name is '웹 또는 앱 클라이언트 브라우저 이름';
comment on column public.user_devices.app_version is '클라이언트 앱 버전';
comment on column public.user_devices.is_active is '현재 활성 디바이스 여부';
comment on column public.notification_logs.directive_department_id is '관련 부서 배정 레코드';
comment on column public.notification_logs.payload is '알림 이동 경로와 운영용 부가 데이터';
