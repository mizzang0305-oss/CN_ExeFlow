-- CN EXEFLOW 260508 directive import validation
-- Batch: CN_260508_DIRECTIVE_REPLACE_127
-- Year: 2026

-- 1) Imported directive count
with imported as (
  select id, directive_no, title, content, status
  from public.directives
  where content like '%CN_260508_DIRECTIVE_REPLACE_127%'
    and is_archived = false
)
select
  count(*) as imported_directives_count,
  127 as expected_directives_count
from imported;

-- 2) Workflow status guard
select directive_no, title, status
from public.directives
where content like '%CN_260508_DIRECTIVE_REPLACE_127%'
  and status not in ('NEW', 'IN_PROGRESS', 'COMPLETION_REQUESTED', 'DELAYED', 'COMPLETED', 'REJECTED')
order by directive_no;

-- 3) Report bucket totals
with imported as (
  select
    case
      when content like '%- 보고상태: 지속%' then '지속'
      when content like '%- 보고상태: 완료%' then '완료'
      else '진행중'
    end as report_bucket
  from public.directives
  where content like '%CN_260508_DIRECTIVE_REPLACE_127%'
    and is_archived = false
)
select
  count(*) as total_count,
  count(*) filter (where report_bucket = '진행중') as in_progress_count,
  count(*) filter (where report_bucket = '완료') as completed_count,
  count(*) filter (where report_bucket = '지속') as continuing_count,
  127 as expected_total_count,
  99 as expected_in_progress_count,
  20 as expected_completed_count,
  8 as expected_continuing_count
from imported;

-- 4) VP No.63 cold-storage correction
select directive_no, title, content
from public.directives
where content like '%CN_260508_DIRECTIVE_REPLACE_127%'
  and content like '%- 원본시트: 부사장 지시사항%'
  and content like '%- 원본번호: 63%'
  and title = '기획영업부 사무실 냉동창고 공사: 공간 재배치·대체 사무공간·공사비·효율 검토 후 결재문 구체화';

-- 5) Department report summary
with imported as (
  select
    id,
    case
      when content like '%- 보고상태: 지속%' then '지속'
      when content like '%- 보고상태: 완료%' then '완료'
      else '진행중'
    end as report_bucket,
    regexp_replace(
      substring(content from '- 보고담당부서: ([^\n]+)'),
      '^[- ]+',
      ''
    ) as report_departments
  from public.directives
  where content like '%CN_260508_DIRECTIVE_REPLACE_127%'
    and is_archived = false
), exploded as (
  select trim(dep.department_name) as department_name, imported.report_bucket
  from imported
  join lateral regexp_split_to_table(imported.report_departments, '\s*,\s*') as dep(department_name)
    on true
), actual as (
  select
    department_name,
    count(*)::int as total_count,
    count(*) filter (where report_bucket = '진행중')::int as in_progress_count,
    count(*) filter (where report_bucket = '완료')::int as completed_count,
    count(*) filter (where report_bucket = '지속')::int as continuing_count,
    round((count(*) filter (where report_bucket in ('완료', '지속'))::numeric / nullif(count(*), 0)) * 100)::int as completion_rate
  from exploded
  group by department_name
), expected as (
  select * from (
    values
  ('전 부서', 37, 29, 5, 3, 22),
  ('기획영업부', 36, 29, 4, 3, 19),
  ('경영관리센터', 38, 30, 8, 0, 21),
  ('구매물류부', 28, 23, 4, 1, 18),
  ('각 부서장', 2, 1, 1, 0, 50),
  ('각 리더', 2, 1, 0, 1, 50),
  ('공장총괄본부', 1, 1, 0, 0, 0)
  ) as e(department_name, total_count, in_progress_count, completed_count, continuing_count, completion_rate)
)
select
  e.department_name,
  a.total_count,
  e.total_count as expected_total_count,
  a.in_progress_count,
  e.in_progress_count as expected_in_progress_count,
  a.completed_count,
  e.completed_count as expected_completed_count,
  a.continuing_count,
  e.continuing_count as expected_continuing_count,
  a.completion_rate,
  e.completion_rate as expected_completion_rate
from expected e
left join actual a on a.department_name = e.department_name
order by array_position(array['전 부서', '기획영업부', '경영관리센터', '구매물류부', '각 부서장', '각 리더', '공장총괄본부'], e.department_name);

-- 6) 전 부서 must not expand to every active department
with all_department_directives as (
  select id, directive_no, title
  from public.directives
  where content like '%CN_260508_DIRECTIVE_REPLACE_127%'
    and content like '%- 보고담당부서: 전 부서%'
    and is_archived = false
)
select
  d.directive_no,
  d.title,
  count(dd.id) as assignment_count
from all_department_directives d
left join public.directive_departments dd on dd.directive_id = d.id
group by d.directive_no, d.title
having count(dd.id) <> 1
order by d.directive_no;
