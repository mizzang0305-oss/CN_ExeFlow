-- Restrict direct Supabase REST access to application tables.
-- The Next.js app uses the service role on the server and enforces app-level
-- authorization before database access. Public anon/authenticated REST access
-- should not be able to read or mutate operational tables directly.

do $$
declare
  app_table record;
begin
  for app_table in
    select
      format('%I.%I', n.nspname, c.relname) as qualified_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname not like 'pg_%'
  loop
    execute format('alter table %s enable row level security', app_table.qualified_name);
    execute format('alter table %s force row level security', app_table.qualified_name);
  end loop;
end $$;

do $$
begin
  revoke all privileges on all tables in schema public from public;
  revoke all privileges on all sequences in schema public from public;
  revoke all privileges on all functions in schema public from public;
  alter default privileges in schema public revoke all on tables from public;
  alter default privileges in schema public revoke all on sequences from public;
  alter default privileges in schema public revoke all on functions from public;
exception
  when undefined_object then null;
end $$;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all privileges on all tables in schema public from %I', role_name);
      execute format('revoke all privileges on all sequences in schema public from %I', role_name);
      execute format('revoke all privileges on all functions in schema public from %I', role_name);
      execute format('alter default privileges in schema public revoke all on tables from %I', role_name);
      execute format('alter default privileges in schema public revoke all on sequences from %I', role_name);
      execute format('alter default privileges in schema public revoke all on functions from %I', role_name);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant all privileges on all tables in schema public to service_role;
    grant all privileges on all sequences in schema public to service_role;
    grant all privileges on all functions in schema public to service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant all on sequences to service_role;
    alter default privileges in schema public grant all on functions to service_role;
  end if;
end $$;
