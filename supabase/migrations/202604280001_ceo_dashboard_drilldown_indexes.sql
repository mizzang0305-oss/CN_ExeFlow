create index if not exists idx_directive_departments_department_directive
  on public.directive_departments (department_id, directive_id);

create index if not exists idx_directives_status_deleted_created
  on public.directives (status, is_deleted, created_at desc);

create index if not exists idx_directives_urgent_deleted_created
  on public.directives (is_urgent, is_deleted, created_at desc);

create index if not exists idx_directives_deleted_created
  on public.directives (is_deleted, created_at desc);
