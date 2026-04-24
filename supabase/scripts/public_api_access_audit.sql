-- Public API access audit for CN EXEFLOW.
-- Run before and after 202604240001_restrict_public_api_access.sql.

with relations as (
  select
    n.nspname as schema_name,
    c.relname as relation_name,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      else c.relkind::text
    end as relation_type,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
),
role_grants as (
  select
    table_schema,
    table_name,
    grantee,
    string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
  group by table_schema, table_name, grantee
)
select
  r.schema_name,
  r.relation_name,
  r.relation_type,
  r.rls_enabled,
  r.rls_forced,
  coalesce(max(case when g.grantee = 'anon' then g.privileges end), '') as anon_privileges,
  coalesce(max(case when g.grantee = 'authenticated' then g.privileges end), '') as authenticated_privileges
from relations r
left join role_grants g
  on g.table_schema = r.schema_name
 and g.table_name = r.relation_name
group by
  r.schema_name,
  r.relation_name,
  r.relation_type,
  r.rls_enabled,
  r.rls_forced
order by
  r.relation_type,
  r.relation_name;

-- Optional smoke checks in SQL Editor:
-- set local role anon;
-- select count(*) from public.directives;
-- reset role;
