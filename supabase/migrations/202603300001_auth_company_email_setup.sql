alter table public.users
  alter column email drop not null;

create index if not exists idx_users_department_name_active
  on public.users (department_id, name)
  where is_active = true;

create index if not exists idx_users_email_normalized
  on public.users ((lower(btrim(email))))
  where email is not null;

comment on index idx_users_department_name_active is '최초 사용자 설정 시 부서 + 이름 조회를 빠르게 지원';
comment on index idx_users_email_normalized is '회사 이메일 trim/lowercase 정규화 조회 지원';
