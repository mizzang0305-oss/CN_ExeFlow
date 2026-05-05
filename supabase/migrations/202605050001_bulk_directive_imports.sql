create table if not exists public.bulk_import_batches (
  id uuid primary key,
  type text not null,
  file_name text not null,
  status text not null default 'PREVIEW',
  total_rows int not null default 0,
  valid_rows int not null default 0,
  invalid_rows int not null default 0,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  registered_at timestamptz null,
  constraint bulk_import_batches_status_check
    check (status in ('PREVIEW', 'REGISTERED', 'CANCELED', 'FAILED')),
  constraint bulk_import_batches_type_check
    check (type in ('DIRECTIVE'))
);

create table if not exists public.bulk_import_rows (
  id uuid primary key,
  batch_id uuid not null references public.bulk_import_batches(id) on delete restrict,
  row_number int not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb null,
  valid boolean not null default false,
  errors jsonb not null default '[]'::jsonb,
  directive_id uuid null references public.directives(id),
  created_at timestamptz not null default now(),
  constraint bulk_import_rows_batch_row_unique unique (batch_id, row_number),
  constraint bulk_import_rows_directive_unique unique (directive_id)
);

alter table public.directives
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null references public.users(id),
  add column if not exists archive_reason text null;

create index if not exists idx_bulk_import_batches_type_created
  on public.bulk_import_batches (type, created_at desc);

create index if not exists idx_bulk_import_batches_created_by_created
  on public.bulk_import_batches (created_by, created_at desc);

create index if not exists idx_bulk_import_rows_batch_valid
  on public.bulk_import_rows (batch_id, valid, row_number);

create index if not exists idx_bulk_import_rows_directive
  on public.bulk_import_rows (directive_id)
  where directive_id is not null;

create index if not exists idx_directives_archived_at
  on public.directives (archived_at desc)
  where is_archived = true;
