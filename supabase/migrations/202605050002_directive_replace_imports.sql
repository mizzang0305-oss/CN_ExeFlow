alter table public.bulk_import_batches
  add column if not exists replace_mode boolean not null default false,
  add column if not exists archived_directives_count int not null default 0,
  add column if not exists archive_reason text null;

alter table public.directives
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null references public.users(id),
  add column if not exists archive_reason text null;

do $$
begin
  alter table public.bulk_import_batches
    drop constraint if exists bulk_import_batches_type_check;

  alter table public.bulk_import_batches
    add constraint bulk_import_batches_type_check
    check (type in ('DIRECTIVE', 'DIRECTIVE_REPLACE'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_bulk_import_batches_replace_created
  on public.bulk_import_batches (replace_mode, created_at desc);
