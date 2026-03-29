alter table if exists public.directives
  add column if not exists target_scope text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'directives'
      and column_name = 'target_scope'
  ) then
    update public.directives
    set target_scope = coalesce(target_scope, 'SELECTED');

    begin
      alter table public.directives
        alter column target_scope set default 'SELECTED';
    exception
      when others then null;
    end;

    begin
      alter table public.directives
        add constraint directives_target_scope_check
        check (target_scope in ('ALL', 'SELECTED'));
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

alter table if exists public.directive_departments
  add column if not exists is_primary boolean;

alter table if exists public.directive_departments
  add column if not exists assignment_role text;

update public.directive_departments
set
  is_primary = coalesce(is_primary, false),
  assignment_role = coalesce(assignment_role, 'SUPPORT')
where is_primary is null
   or assignment_role is null;

update public.directive_departments as dd
set
  is_primary = true,
  assignment_role = 'OWNER'
from public.directives as d
where d.id = dd.directive_id
  and d.owner_department_id = dd.department_id;

alter table if exists public.directive_departments
  alter column is_primary set default false;

alter table if exists public.directive_departments
  alter column assignment_role set default 'SUPPORT';

do $$
begin
  begin
    alter table public.directive_departments
      add constraint directive_departments_assignment_role_check
      check (assignment_role in ('OWNER', 'SUPPORT', 'REFERENCE'));
  exception
    when duplicate_object then null;
  end;
end $$;

update public.directives as d
set target_scope = case
  when assignment_counts.department_count = active_counts.active_department_count then 'ALL'
  else 'SELECTED'
end
from (
  select directive_id, count(*) as department_count
  from public.directive_departments
  group by directive_id
) as assignment_counts
cross join (
  select count(*) as active_department_count
  from public.departments
  where is_active = true
) as active_counts
where d.id = assignment_counts.directive_id
  and d.target_scope is null;
