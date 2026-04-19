-- CN EXEFLOW 초기 지시사항 77건 검증 SQL
-- 대상 배치: CN_INITIAL_IMPORT_77
-- 대상 연도: 2025

-- 1) 실행 전 import 계정 후보 확인
select
  id,
  email,
  name,
  role,
  is_active
from public.users
where is_active = true
  and role in ('CEO', 'SUPER_ADMIN')
order by
  case when role = 'CEO' then 0 else 1 end,
  name;

-- 2) 실행 전 레거시 부서명 매핑 확인
with legacy_map as (
  select *
  from (
    values
      ('기획영업부', '영업본부'),
      ('경영지원센터', '경영관리부'),
      ('HACCP', '햅썹운용팀'),
      ('구매물류부', '물류부'),
      ('육가공', '육가공팀')
  ) as x(legacy_name, canonical_name)
)
select
  m.legacy_name,
  m.canonical_name,
  d.id as active_department_id,
  d.is_active
from legacy_map m
left join public.departments d
  on d.name = m.canonical_name
 and d.is_active = true
order by m.legacy_name;

-- 3) 실행 전 활성 부서 수 / 전 부서 확장 기준 확인
select
  count(*) as active_department_count
from public.departments
where is_active = true;

-- 4) 실행 전 2025-03 / 2025-04 CN 번호 충돌 후보 확인
select
  directive_no,
  title
from public.directives
where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
order by directive_no;

-- 5) 실행 후 imported directives 총건수 확인
with imported as (
  select
    id,
    directive_no,
    year_month,
    sequence,
    title,
    content,
    owner_department_id,
    target_scope
  from public.directives
  where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
    and content like '%CN_INITIAL_IMPORT_77%'
)
select
  count(*) as imported_directives_count,
  77 as expected_directives_count
from imported;

-- 6) 실행 후 month별 CN 번호 연속성 확인
with imported as (
  select
    directive_no,
    year_month,
    sequence
  from public.directives
  where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
    and content like '%CN_INITIAL_IMPORT_77%'
),
sequenced as (
  select
    directive_no,
    year_month,
    sequence,
    row_number() over (
      partition by year_month
      order by sequence
    ) as expected_sequence
  from imported
)
select
  directive_no,
  year_month,
  sequence,
  expected_sequence
from sequenced
where sequence <> expected_sequence
order by year_month, sequence;

-- 7) 실행 후 directive_departments 총건수 확인
with imported as (
  select
    id
  from public.directives
  where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
    and content like '%CN_INITIAL_IMPORT_77%'
),
active_departments as (
  select count(*)::int as active_department_count
  from public.departments
  where is_active = true
)
select
  (select count(*) from public.directive_departments dd join imported i on i.id = dd.directive_id) as imported_directive_departments_count,
  (select 59 + 27 * active_department_count from active_departments) as expected_directive_departments_count,
  (select active_department_count from active_departments) as active_department_count;

-- 8) 실행 후 owner_department_id 누락 건 확인
select
  directive_no,
  title
from public.directives
where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
  and content like '%CN_INITIAL_IMPORT_77%'
  and owner_department_id is null
order by directive_no;

-- 9) 실행 후 directive_departments 누락 건 확인
with imported as (
  select
    id,
    directive_no,
    title
  from public.directives
  where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
    and content like '%CN_INITIAL_IMPORT_77%'
)
select
  i.directive_no,
  i.title
from imported i
left join public.directive_departments dd
  on dd.directive_id = i.id
group by i.id, i.directive_no, i.title
having count(dd.id) = 0
order by i.directive_no;

-- 10) 실행 후 primary department 1건 보장 확인
with imported as (
  select
    id,
    directive_no
  from public.directives
  where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
    and content like '%CN_INITIAL_IMPORT_77%'
)
select
  i.directive_no,
  count(*) filter (where dd.is_primary) as primary_assignment_count
from imported i
join public.directive_departments dd
  on dd.directive_id = i.id
group by i.directive_no
having count(*) filter (where dd.is_primary) <> 1
order by i.directive_no;

-- 11) 실행 후 [원본이관정보] 블록 존재 여부 확인
select
  directive_no,
  title
from public.directives
where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
  and content like '%CN_INITIAL_IMPORT_77%'
  and content not like '%[원본이관정보]%'
order by directive_no;

-- 12) 실행 후 source_type / priority 보존 라인 확인
select
  directive_no,
  title
from public.directives
where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
  and content like '%CN_INITIAL_IMPORT_77%'
  and (
    content not like '%source_type(보존): MEETING%'
    or content not like '%priority(보존): MEDIUM%'
  )
order by directive_no;

-- 13) 실행 후 directive_no 중복 확인
select
  directive_no,
  count(*) as duplicate_count
from public.directives
where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
group by directive_no
having count(*) > 1
order by directive_no;

-- 14) 실행 후 월별 건수 확인
select
  year_month,
  count(*) as directive_count
from public.directives
where directive_no ~ '^CN-2025-(03|04)-[0-9]{3}$'
  and content like '%CN_INITIAL_IMPORT_77%'
group by year_month
order by year_month;
