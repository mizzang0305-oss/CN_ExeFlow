create index if not exists idx_directive_departments_department_status_created
  on public.directive_departments (department_id, department_status, created_at desc);

create index if not exists idx_directive_departments_department_directive
  on public.directive_departments (department_id, directive_id);

create index if not exists idx_directives_archived_created
  on public.directives (is_archived, created_at desc);

create index if not exists idx_directives_urgent_archived_created
  on public.directives (is_urgent, is_archived, created_at desc);
