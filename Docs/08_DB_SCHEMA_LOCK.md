# DB 스키마 잠금 문서

## 설계 원칙
- 지시사항 마스터와 부서 배정, 과업, 로그, 첨부를 분리
- 상태와 이력은 정규화 수준을 유지하되 운영 속도를 해치지 않음
- 감사 추적을 위해 변경 로그 보존

## 1. departments
```sql
create table departments (
  id uuid primary key,
  code text not null unique,
  name text not null,
  head_user_id uuid null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 2. users
```sql
create table users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('CEO','SUPER_ADMIN','DEPARTMENT_HEAD','STAFF','VIEWER')),
  department_id uuid null references departments(id),
  position text null,
  phone text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 3. directives
```sql
create table directives (
  id uuid primary key,
  directive_no text not null unique,
  title text not null,
  content text not null,
  source_type text not null check (source_type in ('CEO_DIRECT','MEETING','FOLLOW_UP')),
  instructed_at timestamptz not null,
  due_date timestamptz null,
  priority text not null check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text not null check (status in ('NEW','IN_PROGRESS','COMPLETION_REQUESTED','DELAYED','COMPLETED','REJECTED')),
  owner_department_id uuid null references departments(id),
  owner_user_id uuid null references users(id),
  created_by uuid not null references users(id),
  closed_at timestamptz null,
  close_reason text null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 4. directive_departments
```sql
create table directive_departments (
  id uuid primary key,
  directive_id uuid not null references directives(id) on delete cascade,
  department_id uuid not null references departments(id),
  department_head_id uuid null references users(id),
  department_status text not null check (department_status in ('NEW','IN_PROGRESS','COMPLETION_REQUESTED','DELAYED','COMPLETED','REJECTED')),
  assigned_at timestamptz not null default now(),
  department_due_date timestamptz null,
  department_closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (directive_id, department_id)
);
```

## 5. directive_tasks
```sql
create table directive_tasks (
  id uuid primary key,
  directive_id uuid not null references directives(id) on delete cascade,
  department_id uuid not null references departments(id),
  assigned_user_id uuid null references users(id),
  task_title text not null,
  task_description text null,
  status text not null check (status in ('NEW','IN_PROGRESS','COMPLETION_REQUESTED','DELAYED','COMPLETED','REJECTED')),
  due_date timestamptz null,
  completed_at timestamptz null,
  progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 6. directive_logs
```sql
create table directive_logs (
  id uuid primary key,
  directive_id uuid not null references directives(id) on delete cascade,
  task_id uuid null references directive_tasks(id) on delete set null,
  department_id uuid not null references departments(id),
  user_id uuid not null references users(id),
  log_type text not null,
  action_summary text not null,
  detail text null,
  happened_at timestamptz not null,
  next_action text null,
  risk_note text null,
  created_at timestamptz not null default now()
);
```

## 7. directive_attachments
```sql
create table directive_attachments (
  id uuid primary key,
  directive_id uuid not null references directives(id) on delete cascade,
  log_id uuid null references directive_logs(id) on delete set null,
  file_type text not null check (file_type in ('IMAGE','DOCUMENT','OTHER')),
  file_name text not null,
  file_url text not null,
  mime_type text null,
  file_size bigint null,
  uploaded_by uuid not null references users(id),
  uploaded_at timestamptz not null default now()
);
```

## 8. weekly_reports
```sql
create table weekly_reports (
  id uuid primary key,
  week_start date not null,
  week_end date not null,
  total_count int not null default 0,
  new_count int not null default 0,
  in_progress_count int not null default 0,
  delayed_count int not null default 0,
  completed_count int not null default 0,
  completion_rate numeric(5,2) not null default 0,
  on_time_completion_rate numeric(5,2) not null default 0,
  report_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (week_start, week_end)
);
```

## 9. audit_logs
```sql
create table audit_logs (
  id uuid primary key,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb null,
  after_data jsonb null,
  acted_by uuid not null references users(id),
  acted_at timestamptz not null default now()
);
```

## 필수 인덱스
```sql
create index idx_directives_status on directives(status);
create index idx_directives_due_date on directives(due_date);
create index idx_directives_owner_department_id on directives(owner_department_id);
create index idx_directive_departments_department_id on directive_departments(department_id);
create index idx_directive_tasks_assigned_user_id on directive_tasks(assigned_user_id);
create index idx_directive_logs_directive_id on directive_logs(directive_id);
create index idx_directive_logs_department_id on directive_logs(department_id);
create index idx_weekly_reports_week_start_week_end on weekly_reports(week_start, week_end);
```
