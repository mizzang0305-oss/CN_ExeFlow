-- CN EXEFLOW 초기 지시사항 77건 이관
--
-- 실행 순서:
-- 1. 이 스크립트를 실행합니다.
-- 2. 같은 DB에서 supabase/scripts/cn_directives_import_validation.sql 을 실행합니다.
--
-- 설계 메모:
-- - SQL Editor / migration 실행 환경 차이로 temp table, staging table, DO 변수 의존성을 제거했습니다.
-- - 전부 plain SQL CTE만 사용합니다.
-- - 현재 운영 스키마에는 instructed_at / source_type / priority 컬럼이 없어
--   회의일은 created_at 으로 적재하고, source_type=MEETING / priority=MEDIUM 은
--   directives.content 의 [원본이관정보] 블록에 보존합니다.

create extension if not exists pgcrypto;

with
settings as (
  select
    2025::int as import_year,
    'CN_INITIAL_IMPORT_77'::text as import_batch,
    '주식회사 씨엔푸드'::text as all_department_owner_name
),
source_lines as (
  select btrim(line, E'\r') as line
  from regexp_split_to_table($data$
1|3.06|대표|영업 방향 전환 : 주문접수형 → 점유율 확대형 영업으로 강화|기획영업부|진행중|
2|3.06|대표|미사용 거래처·방어필요 지역 한정 전략 단가 운영(전체 인하 금지)|기획영업부|진행중|
3|3.06|대표|경쟁력 품목(오징어채·김치 등) 샘플 제안·방문·한시행사로 사용 전환 추진|기획영업부|진행중|
4|3.06|대표|품질·활용법·조리결과 사진 활용한 설명형·제안형 영업 방식 확대|기획영업부|진행중|
5|3.06|대표|신규 상품·대체 품목 피드백 일 단위 점검·보고(부장/차장급 주도)|전 부서|진행중|
6|3.06|대표|장기적으로 브랜드 신뢰 구축 중심 영업 방향 강화(씨엔푸드·쿠킹데이)|기획영업부|진행중|
7|3.06|부사장|상품·물류 실무인력 채용 예정대로 진행, 야간 관리자·외국인 실무인력 추가 채용 검토|경영지원센터|진행중|
8|3.06|부사장|채용은 단순 충원 아닌 성과 확대+인력 재편 전제로 운영, 채용과 동시 평가·피드백 체계 구축|경영지원센터|진행중|
9|3.06|부사장|HACCP: 주니어 1명 채용+센터장 대행+외부 고문 활용 방향 검토, 세부 운영 추가 논의 후 확정|HACCP|진행중|
10|3.06|부사장|영업 매니저 월 1명씩 보강, 파트장급은 적합 인원 확보 시까지 면접 지속|기획영업부|진행중|
11|3.06|부사장|채권관리 핵심 목표: 약정일 100% 회수 설정, 채권팀·영업·경영지원 공동 프로세스 정비|경영지원센터|진행중|
12|3.06|부사장|카드수수료 절감 위해 통장입금 등 현금성 수금 확대 방향 검토|기획영업부|진행중|
13|3.06|부사장|영업 단가·마진 운영 권한 기준·선조치·사후품의 기준 문서화|기획영업부|진행중|
14|3.06|부사장|카택스 3월 말까지 계도기간 운영, 이후 기준 미준수 시 지급 제외 등 통제 강화|전 부서|진행중|
15|3.06|부사장|회의 내용 문서화 후 하이웍스 등 공식 기록으로 축적, 관리자 대상 기준 교육 강화|전 부서|진행중|
16|3.20|대표|팀 운영·관리자 역할 점검: 회사 기준대로 업무 운영 여부 확인 체계 구축|전 부서|진행중|
17|3.20|대표|부서별 월간 보고 및 평가표 작성 체계 재점검(7월 성과급 평가 반영)|전 부서|진행중|
18|3.20|대표|물류팀 보고·평가 체계 이번 주 내 정리(조광수부장·최수용과장·유숙현팀장 협의)|구매물류부|진행중|
19|3.20|대표|연구소 공간 전환 및 세제혜택 확보 추진(2층 휴게소 활용 검토)|경영지원센터|진행중|
20|3.20|대표|김치류 샘플 100~200박스 적극 배포·공격적 홍보 추진|기획영업부, 구매물류부|진행중|
21|3.20|대표|퇴사자(신대규 팀장) 업무 인수인계 누락사항 파악 및 정리|경영지원센터|진행중|
22|3.20|부사장|박하지 꽃게 악성재고 4월 중 단기 특판 방식 집중 소진 추진(4~5천원 특판)|기획영업부, 구매물류부|진행중|
23|3.20|부사장|국산 고등어 재고 품질 재점검 후 별도 처리방안 수립(사료전환·선별·폐기 순차 검토)|구매물류부|진행중|
24|3.20|부사장|영업 협조 유도: 회사 전략품목 판매 기여도·협조도를 평가 항목에 반영|기획영업부|진행중|
25|3.20|부사장|상품 운영 실패사례 백서 체계 마련(구매배경·판매경과·문제원인·결과·시사점 기록)|기획영업부|진행중|
26|3.20|부사장|향후 회의 시 악성재고·부진재고 진행현황 정례 보고 운영|전 부서|진행중|
27|3.20|부사장|향후 악성재고 보고는 의사결정형 보고체계로 전환(손실규모·보완책·시장영향 포함)|전 부서|진행중|
28|3.22|대표|악성재고 조기 처리 원칙 운영: 행사·대체용도 판매, 필요 시 손실 감수 정리|기획영업부, 구매물류부|진행중|
29|3.22|대표|샘플링 후 결과 회신 및 채택 여부 신속 결정 기준 마련|전 부서|진행중|
30|3.22|대표|기존 거래처 품목 점유율 확대를 핵심 과제로 관리(A급 거래처 집중 추진)|기획영업부|진행중|
31|3.22|대표|주간 보고 및 실적관리표 체계화(신규·품목확대·수금·방문 결과 표준 양식 정비)|전 부서|진행중|
32|3.22|대표|성과 인정 기준 명확화: 결과 중심 관리, 하는 사람과 하지 않는 사람 구분|전 부서|진행중|
33|3.22|대표|전략팀·신규개발팀 영업지원·수익성 데이터 제공 기능 보강|기획영업부|진행중|
34|3.22|대표|거래처 핵심 인물(주방장·실장·사장) 관계영업 신뢰 형성 및 정보 확보 강화|기획영업부|진행중|
35|3.27|부사장|야간 운영: 당직자 중심 보완체계 우선 운영, 기획팀 로테이션 야간 당직 1명 배치|기획영업부|진행중|
36|3.27|부사장|도크·출고시간 조정은 일부 대상부터 순차 검토(영업총괄 박정민 차장 협의)|기획영업부, 구매물류부|진행중|
37|3.27|부사장|육가공·수산 신제품 입고 시 HACCP 통보 및 보고·서류 확보 절차 정비 후 전파|구매물류부, HACCP|진행중|
38|3.27|부사장|해동 제품 해동중 표시·해동실 사용·온도유지 기준 재강조, 개봉 해동 금지 방향 계도|전 부서|진행중|
39|3.27|부사장|부진재고 선공지 원칙 관리, 박하지 가격 확정 후 대표 보고, 단호박 원물 판매 중단 후 가공·외부처리 검토|구매물류부|진행중|
40|3.27|부사장|청소인력 관련: 질서 위반 인원 TF 조사·징계위원회 회부 검토, 리더 중심 기본 태도 교육 즉시 강화|전 부서|진행중|
41|3.27|부사장|부서별 청소 임시 담당구역 지정 운영(월:경영지원센터, 화:기획영업부, 수:구매물류부)|전 부서|진행중|
42|4.03|부사장|주간회의 일반 현황공유보다 의사결정·이슈해결 중심으로 운영, 단순 공유사항은 사전 전달|전 부서|진행중|
43|4.03|부사장|4월 영업: 주차별 행사·물량 배분 중심 운영, 가격인상·비용상승 변수 반영 관리|기획영업부|진행중|
44|4.03|부사장|수산물 해동 원칙적 금지 방향 관리, 거래처 D+2 선주문 체계 유도|전 부서|진행중|
45|4.03|부사장|해동 요청 현행 카톡방식 유지, 업체명·상품명·대표자명 핵심정보 기재 강화 및 현장 표기 보완|전 부서|진행중|
46|4.03|부사장|클레임 관리대장·이물 대응 기준 영업부 협의 후 매뉴얼 형태 정리(4단계 유형화)|전 부서|진행중|
47|4.03|부사장|작업 닭다리 재고 내부 처리 한계 고려, 외주 활용 포함 실행방안 추진(4월 말까지 약 30톤)|기획영업부, 구매물류부|진행중|
48|4.03|부사장|갈비탕용 등 추가 수요 품목 시세·작업여건 확인 후 리스트화 검토|육가공|진행중|
49|4.03|부사장|시설 안전 문제 비교견적 및 즉시 공유체계 통해 조치속도 높임|경영지원센터|진행중|
50|4.03|부사장|품질 개선 재고 품목(열빙어 등) 영업 관심품목으로 관리, 자연출고·추가판매 유도|기획영업부|진행중|
51|4.03|부사장|랩비닐 등 부자재 추가 확보와 절약 운영 병행(홍보 캠페인·공문 작성 검토)|전 부서|진행중|
52|4.10|대표|부진재고 자연소진보다 행사 중심 소진전략 우선 적용|기획영업부, 구매물류부|진행중|
53|4.10|대표|판매집중 품목(미국북채·붕어빵류·돌돌말이대패삼겹살 등) 영업부·기획팀 공격적 판매 추진|기획영업부|진행중|
54|4.10|대표|반응 좋은 신상품 지속 운영, 특식 제안·사진자료 등 판매지원 요소 강화|기획영업부|진행중|
55|4.10|대표|박스 개봉 해동 금주 계도 후 다음 주부터 전면 중단, 불가피 해동은 통제된 내부공간만 운영|전 부서|진행중|
56|4.10|대표|해동 관련 거래처 안내문구·계도자료 최신 근거자료 기준으로 정리, 영업·물류 동일 기준 공유|전 부서|진행중|
57|4.10|대표|건물관리 공백 대비 대체 인력 또는 후속 대응체계 검토|경영지원센터|진행중|
58|4.10|대표|공구·비품 보관공간 잠금 운영 유지, 열쇠 지정장소 보관 및 사용기록·원위치 원칙 강화|경영지원센터|진행중|
59|4.10|대표|저수조 청소 4/17 공장동·4/19~20 근생동 일정 연계 추진, 사전 사용량 계산 및 공급조절 협의|경영지원센터|진행중|
60|4.10|대표|냉동고 열선 공사 시 출입통제·양생시간 준수 강하게 적용하여 재손상 방지|경영지원센터|진행중|
61|4.10|대표|냉동창고 결로·전기위험 문제 송풍·제습·전기보완과 감지기 개선안 병행 검토, 최신 기준 재확인 후 결정|경영지원센터|진행중|
62|4.10|대표|지게차 속도 저감·현장 안전계도 강화하여 시설보강 효과가 실제 안전으로 이어지도록 관리|전 부서|진행중|
63|4.10|대표|인력평가·조기승진 공식 추천 및 명확한 평가기준 전제 운영(추천 월요일까지 취합)|전 부서|진행중|
64|4.10|대표|신규영업: 신용 우량 거래처 한정 선점형 가격전략, 고마진 품목 병행 제안으로 수익구조 확보|기획영업부|진행중|
65|4.10|대표|기숙사 월 1회 안전점검·위생점검 연계 운영|경영지원센터|진행중|
66|4.17|부사장|소방 편제 현장 체류인원 중심으로 구성, 대피반·소화반·비상연락망 다음 주까지 종합 정리|경영지원센터|진행중|
67|4.17|부사장|소방 편제 확정 후 정기 교육·훈련 연계, 소방서 연계 합동훈련까지 순차 추진|전 부서|진행중|
68|4.17|부사장|층별·팀별 필수 인원 편제와 비상연락처 취합 제출, 리더는 소화전 위치·비상조치 순서 숙지|전 부서|진행중|
69|4.17|부사장|소화기 정기 점검 기준 마련 검토, 무게·상태 주기적 확인 체계 구축|경영지원센터|진행중|
70|4.17|부사장|감지기·전기설비 교체·보강 추진, 관련 견적 계속 검토|경영지원센터|진행중|
71|4.17|부사장|근생동·공장동 시설 위험요소 재점검 및 보강 우선순위 정리|경영지원센터|진행중|
72|4.17|부사장|관리자 대상 화재 초기대응 교육 실제 행동 위주로 반복 실시|전 부서|진행중|
73|4.17|부사장|저수조 청소 전 물 활용(청소·방수 연습 등) 계획 일정에 맞춰 사전 공유|경영지원센터|진행중|
74|4.17|부사장|도크 운영시간 전면 후행 이동 대신 병목 분산 중심으로 검토, 기사·영업·물류 실무 반영 별도 협의|기획영업부, 구매물류부|진행중|
75|4.17|부사장|주문 마감 1차/2차 발주 분리 방안 기획영업팀 실현가능성 먼저 검토, 1~2개 파트 시험 적용 여부 판단(월요일 10시 추가 논의)|기획영업부, 구매물류부|진행중|
76|4.17|부사장|경고 3회 이후 운영기준 취지 유지, 사면성 리셋 또는 상벌 연계형 보완방안 별도 지침 받아 검토|전 부서|진행중|
77|4.17|부사장|리더 공식석상 감정 배설성 발언 지양, 배려·명확성 중심 표현 기준 준수 재강조|전 부서|진행중|
$data$, E'\n') as line
  where btrim(line, E'\r') <> ''
),
source_rows as (
  select
    split_part(line, '|', 1)::int as source_no,
    split_part(line, '|', 2) as meeting_date_raw,
    split_part(line, '|', 3) as chair_role,
    split_part(line, '|', 4) as directive_text,
    split_part(line, '|', 5) as departments_raw,
    split_part(line, '|', 6) as status_ko,
    nullif(split_part(line, '|', 7), '') as note
  from source_lines
),
department_map(legacy_name, canonical_name) as (
  values
    ('기획영업부', '영업본부'),
    ('경영지원센터', '경영관리부'),
    ('HACCP', '햅썹운용팀'),
    ('구매물류부', '물류부'),
    ('육가공', '육가공팀')
),
import_user as (
  select u.id
  from public.users u
  where u.is_active = true
    and u.role in ('CEO', 'SUPER_ADMIN')
  order by
    case when u.role = 'CEO' then 0 else 1 end,
    u.created_at nulls first,
    u.email
  limit 1
),
active_departments as (
  select
    d.id,
    d.name,
    d.head_user_id,
    d.sort_order
  from public.departments d
  where d.is_active = true
),
normalized as (
  select
    s.*,
    split_part(s.meeting_date_raw, '.', 1)::int as meeting_month,
    split_part(s.meeting_date_raw, '.', 2)::int as meeting_day,
    row_number() over (
      partition by split_part(s.meeting_date_raw, '.', 1)::int
      order by s.source_no
    )::int as month_seq,
    case s.status_ko
      when '진행중' then 'IN_PROGRESS'
      else null
    end as status_en
  from source_rows s
),
prepared as (
  select
    n.source_no,
    n.meeting_date_raw,
    n.chair_role,
    n.directive_text,
    n.departments_raw,
    n.status_ko,
    n.note,
    n.meeting_month,
    n.meeting_day,
    n.month_seq,
    s.import_year,
    s.import_batch,
    s.all_department_owner_name,
    format(
      'CN-%s-%s-%s',
      s.import_year,
      lpad(n.meeting_month::text, 2, '0'),
      lpad(n.month_seq::text, 3, '0')
    ) as directive_no,
    format('%s-%s', s.import_year, lpad(n.meeting_month::text, 2, '0')) as year_month,
    make_timestamptz(s.import_year, n.meeting_month, n.meeting_day, 9, 0, 0, 'Asia/Seoul') as directive_created_at,
    case
      when n.departments_raw = '전 부서' then 'ALL'
      else 'SELECTED'
    end as target_scope,
    n.status_en
  from normalized n
  cross join settings s
),
selected_targets as (
  select
    p.directive_no,
    p.status_en,
    p.directive_created_at as assigned_at,
    p.target_scope,
    dep.ordinality::int as target_order,
    d.id as department_id,
    d.name as department_name,
    d.head_user_id as department_head_id
  from prepared p
  join lateral regexp_split_to_table(p.departments_raw, '\s*,\s*') with ordinality as dep(legacy_name, ordinality)
    on p.target_scope = 'SELECTED'
  join department_map m
    on m.legacy_name = trim(dep.legacy_name)
  join active_departments d
    on d.name = m.canonical_name
),
all_targets as (
  select
    p.directive_no,
    p.status_en,
    p.directive_created_at as assigned_at,
    p.target_scope,
    case
      when d.name = p.all_department_owner_name then 0
      else 1000 + row_number() over (
        partition by p.directive_no
        order by d.sort_order nulls last, d.name
      )
    end as target_order,
    d.id as department_id,
    d.name as department_name,
    d.head_user_id as department_head_id
  from prepared p
  join active_departments d
    on p.target_scope = 'ALL'
),
target_union as (
  select * from selected_targets
  union all
  select * from all_targets
),
target_departments as (
  select distinct on (u.directive_no, u.department_id)
    u.directive_no,
    u.status_en,
    u.assigned_at,
    u.target_scope,
    u.target_order,
    u.department_id,
    u.department_name,
    u.department_head_id
  from target_union u
  order by u.directive_no, u.department_id, u.target_order
),
target_with_primary as (
  select
    t.*,
    min(t.target_order) over (partition by t.directive_no) as primary_target_order
  from target_departments t
),
owner_departments as (
  select
    t.directive_no,
    t.department_id as owner_department_id,
    t.department_name as owner_department_name
  from target_with_primary t
  where t.target_order = t.primary_target_order
),
selected_department_names as (
  select
    t.directive_no,
    string_agg(distinct t.department_name, ', ' order by t.department_name) as mapped_department_names
  from target_departments t
  where t.target_scope = 'SELECTED'
  group by t.directive_no
),
resolved as (
  select
    p.source_no,
    p.meeting_date_raw,
    p.chair_role,
    p.directive_text,
    p.departments_raw,
    p.status_ko,
    p.note,
    p.month_seq,
    p.directive_no,
    p.year_month,
    p.directive_created_at,
    p.target_scope,
    p.status_en,
    p.import_batch,
    p.import_year,
    o.owner_department_id,
    o.owner_department_name,
    sdn.mapped_department_names,
    (select count(*) from active_departments) as active_department_count
  from prepared p
  join owner_departments o
    on o.directive_no = p.directive_no
  left join selected_department_names sdn
    on sdn.directive_no = p.directive_no
)
insert into public.directives as d (
  id,
  directive_no,
  year_month,
  sequence,
  title,
  content,
  status,
  is_urgent,
  urgent_level,
  due_date,
  created_by,
  created_at,
  owner_department_id,
  owner_user_id,
  is_archived,
  target_scope
)
select
  gen_random_uuid(),
  r.directive_no,
  r.year_month,
  r.month_seq,
  r.directive_text,
  r.directive_text
    || E'\n\n[원본이관정보]'
    || E'\n- 이관배치: ' || r.import_batch
    || E'\n- 원본번호: ' || r.source_no::text
    || E'\n- 원본회의일: ' || r.meeting_date_raw
    || E'\n- 적용연도: ' || r.import_year::text
    || E'\n- 주관: ' || r.chair_role
    || E'\n- 원본상태: ' || r.status_ko
    || E'\n- 원본담당부서: ' || r.departments_raw
    || E'\n- 이관주관부서: ' || r.owner_department_name
    || E'\n- 이관담당부서: '
    || case
      when r.target_scope = 'ALL'
        then '전 부서 -> 현재 활성 부서 전체 배정 (' || r.active_department_count::text || '개)'
      else coalesce(r.mapped_department_names, '')
    end
    || E'\n- source_type(보존): MEETING'
    || E'\n- priority(보존): MEDIUM'
    || coalesce(E'\n- 비고: ' || r.note, ''),
  r.status_en,
  false,
  null,
  null,
  (select iu.id from import_user iu),
  r.directive_created_at,
  r.owner_department_id,
  null,
  false,
  r.target_scope
from resolved r
on conflict (directive_no) do update
set
  title = excluded.title,
  content = excluded.content,
  year_month = excluded.year_month,
  sequence = excluded.sequence,
  owner_department_id = excluded.owner_department_id,
  target_scope = excluded.target_scope
where position('CN_INITIAL_IMPORT_77' in coalesce(d.content, '')) > 0;

with
settings as (
  select
    2025::int as import_year,
    'CN_INITIAL_IMPORT_77'::text as import_batch,
    '주식회사 씨엔푸드'::text as all_department_owner_name
),
source_lines as (
  select btrim(line, E'\r') as line
  from regexp_split_to_table($data$
1|3.06|대표|영업 방향 전환 : 주문접수형 → 점유율 확대형 영업으로 강화|기획영업부|진행중|
2|3.06|대표|미사용 거래처·방어필요 지역 한정 전략 단가 운영(전체 인하 금지)|기획영업부|진행중|
3|3.06|대표|경쟁력 품목(오징어채·김치 등) 샘플 제안·방문·한시행사로 사용 전환 추진|기획영업부|진행중|
4|3.06|대표|품질·활용법·조리결과 사진 활용한 설명형·제안형 영업 방식 확대|기획영업부|진행중|
5|3.06|대표|신규 상품·대체 품목 피드백 일 단위 점검·보고(부장/차장급 주도)|전 부서|진행중|
6|3.06|대표|장기적으로 브랜드 신뢰 구축 중심 영업 방향 강화(씨엔푸드·쿠킹데이)|기획영업부|진행중|
7|3.06|부사장|상품·물류 실무인력 채용 예정대로 진행, 야간 관리자·외국인 실무인력 추가 채용 검토|경영지원센터|진행중|
8|3.06|부사장|채용은 단순 충원 아닌 성과 확대+인력 재편 전제로 운영, 채용과 동시 평가·피드백 체계 구축|경영지원센터|진행중|
9|3.06|부사장|HACCP: 주니어 1명 채용+센터장 대행+외부 고문 활용 방향 검토, 세부 운영 추가 논의 후 확정|HACCP|진행중|
10|3.06|부사장|영업 매니저 월 1명씩 보강, 파트장급은 적합 인원 확보 시까지 면접 지속|기획영업부|진행중|
11|3.06|부사장|채권관리 핵심 목표: 약정일 100% 회수 설정, 채권팀·영업·경영지원 공동 프로세스 정비|경영지원센터|진행중|
12|3.06|부사장|카드수수료 절감 위해 통장입금 등 현금성 수금 확대 방향 검토|기획영업부|진행중|
13|3.06|부사장|영업 단가·마진 운영 권한 기준·선조치·사후품의 기준 문서화|기획영업부|진행중|
14|3.06|부사장|카택스 3월 말까지 계도기간 운영, 이후 기준 미준수 시 지급 제외 등 통제 강화|전 부서|진행중|
15|3.06|부사장|회의 내용 문서화 후 하이웍스 등 공식 기록으로 축적, 관리자 대상 기준 교육 강화|전 부서|진행중|
16|3.20|대표|팀 운영·관리자 역할 점검: 회사 기준대로 업무 운영 여부 확인 체계 구축|전 부서|진행중|
17|3.20|대표|부서별 월간 보고 및 평가표 작성 체계 재점검(7월 성과급 평가 반영)|전 부서|진행중|
18|3.20|대표|물류팀 보고·평가 체계 이번 주 내 정리(조광수부장·최수용과장·유숙현팀장 협의)|구매물류부|진행중|
19|3.20|대표|연구소 공간 전환 및 세제혜택 확보 추진(2층 휴게소 활용 검토)|경영지원센터|진행중|
20|3.20|대표|김치류 샘플 100~200박스 적극 배포·공격적 홍보 추진|기획영업부, 구매물류부|진행중|
21|3.20|대표|퇴사자(신대규 팀장) 업무 인수인계 누락사항 파악 및 정리|경영지원센터|진행중|
22|3.20|부사장|박하지 꽃게 악성재고 4월 중 단기 특판 방식 집중 소진 추진(4~5천원 특판)|기획영업부, 구매물류부|진행중|
23|3.20|부사장|국산 고등어 재고 품질 재점검 후 별도 처리방안 수립(사료전환·선별·폐기 순차 검토)|구매물류부|진행중|
24|3.20|부사장|영업 협조 유도: 회사 전략품목 판매 기여도·협조도를 평가 항목에 반영|기획영업부|진행중|
25|3.20|부사장|상품 운영 실패사례 백서 체계 마련(구매배경·판매경과·문제원인·결과·시사점 기록)|기획영업부|진행중|
26|3.20|부사장|향후 회의 시 악성재고·부진재고 진행현황 정례 보고 운영|전 부서|진행중|
27|3.20|부사장|향후 악성재고 보고는 의사결정형 보고체계로 전환(손실규모·보완책·시장영향 포함)|전 부서|진행중|
28|3.22|대표|악성재고 조기 처리 원칙 운영: 행사·대체용도 판매, 필요 시 손실 감수 정리|기획영업부, 구매물류부|진행중|
29|3.22|대표|샘플링 후 결과 회신 및 채택 여부 신속 결정 기준 마련|전 부서|진행중|
30|3.22|대표|기존 거래처 품목 점유율 확대를 핵심 과제로 관리(A급 거래처 집중 추진)|기획영업부|진행중|
31|3.22|대표|주간 보고 및 실적관리표 체계화(신규·품목확대·수금·방문 결과 표준 양식 정비)|전 부서|진행중|
32|3.22|대표|성과 인정 기준 명확화: 결과 중심 관리, 하는 사람과 하지 않는 사람 구분|전 부서|진행중|
33|3.22|대표|전략팀·신규개발팀 영업지원·수익성 데이터 제공 기능 보강|기획영업부|진행중|
34|3.22|대표|거래처 핵심 인물(주방장·실장·사장) 관계영업 신뢰 형성 및 정보 확보 강화|기획영업부|진행중|
35|3.27|부사장|야간 운영: 당직자 중심 보완체계 우선 운영, 기획팀 로테이션 야간 당직 1명 배치|기획영업부|진행중|
36|3.27|부사장|도크·출고시간 조정은 일부 대상부터 순차 검토(영업총괄 박정민 차장 협의)|기획영업부, 구매물류부|진행중|
37|3.27|부사장|육가공·수산 신제품 입고 시 HACCP 통보 및 보고·서류 확보 절차 정비 후 전파|구매물류부, HACCP|진행중|
38|3.27|부사장|해동 제품 해동중 표시·해동실 사용·온도유지 기준 재강조, 개봉 해동 금지 방향 계도|전 부서|진행중|
39|3.27|부사장|부진재고 선공지 원칙 관리, 박하지 가격 확정 후 대표 보고, 단호박 원물 판매 중단 후 가공·외부처리 검토|구매물류부|진행중|
40|3.27|부사장|청소인력 관련: 질서 위반 인원 TF 조사·징계위원회 회부 검토, 리더 중심 기본 태도 교육 즉시 강화|전 부서|진행중|
41|3.27|부사장|부서별 청소 임시 담당구역 지정 운영(월:경영지원센터, 화:기획영업부, 수:구매물류부)|전 부서|진행중|
42|4.03|부사장|주간회의 일반 현황공유보다 의사결정·이슈해결 중심으로 운영, 단순 공유사항은 사전 전달|전 부서|진행중|
43|4.03|부사장|4월 영업: 주차별 행사·물량 배분 중심 운영, 가격인상·비용상승 변수 반영 관리|기획영업부|진행중|
44|4.03|부사장|수산물 해동 원칙적 금지 방향 관리, 거래처 D+2 선주문 체계 유도|전 부서|진행중|
45|4.03|부사장|해동 요청 현행 카톡방식 유지, 업체명·상품명·대표자명 핵심정보 기재 강화 및 현장 표기 보완|전 부서|진행중|
46|4.03|부사장|클레임 관리대장·이물 대응 기준 영업부 협의 후 매뉴얼 형태 정리(4단계 유형화)|전 부서|진행중|
47|4.03|부사장|작업 닭다리 재고 내부 처리 한계 고려, 외주 활용 포함 실행방안 추진(4월 말까지 약 30톤)|기획영업부, 구매물류부|진행중|
48|4.03|부사장|갈비탕용 등 추가 수요 품목 시세·작업여건 확인 후 리스트화 검토|육가공|진행중|
49|4.03|부사장|시설 안전 문제 비교견적 및 즉시 공유체계 통해 조치속도 높임|경영지원센터|진행중|
50|4.03|부사장|품질 개선 재고 품목(열빙어 등) 영업 관심품목으로 관리, 자연출고·추가판매 유도|기획영업부|진행중|
51|4.03|부사장|랩비닐 등 부자재 추가 확보와 절약 운영 병행(홍보 캠페인·공문 작성 검토)|전 부서|진행중|
52|4.10|대표|부진재고 자연소진보다 행사 중심 소진전략 우선 적용|기획영업부, 구매물류부|진행중|
53|4.10|대표|판매집중 품목(미국북채·붕어빵류·돌돌말이대패삼겹살 등) 영업부·기획팀 공격적 판매 추진|기획영업부|진행중|
54|4.10|대표|반응 좋은 신상품 지속 운영, 특식 제안·사진자료 등 판매지원 요소 강화|기획영업부|진행중|
55|4.10|대표|박스 개봉 해동 금주 계도 후 다음 주부터 전면 중단, 불가피 해동은 통제된 내부공간만 운영|전 부서|진행중|
56|4.10|대표|해동 관련 거래처 안내문구·계도자료 최신 근거자료 기준으로 정리, 영업·물류 동일 기준 공유|전 부서|진행중|
57|4.10|대표|건물관리 공백 대비 대체 인력 또는 후속 대응체계 검토|경영지원센터|진행중|
58|4.10|대표|공구·비품 보관공간 잠금 운영 유지, 열쇠 지정장소 보관 및 사용기록·원위치 원칙 강화|경영지원센터|진행중|
59|4.10|대표|저수조 청소 4/17 공장동·4/19~20 근생동 일정 연계 추진, 사전 사용량 계산 및 공급조절 협의|경영지원센터|진행중|
60|4.10|대표|냉동고 열선 공사 시 출입통제·양생시간 준수 강하게 적용하여 재손상 방지|경영지원센터|진행중|
61|4.10|대표|냉동창고 결로·전기위험 문제 송풍·제습·전기보완과 감지기 개선안 병행 검토, 최신 기준 재확인 후 결정|경영지원센터|진행중|
62|4.10|대표|지게차 속도 저감·현장 안전계도 강화하여 시설보강 효과가 실제 안전으로 이어지도록 관리|전 부서|진행중|
63|4.10|대표|인력평가·조기승진 공식 추천 및 명확한 평가기준 전제 운영(추천 월요일까지 취합)|전 부서|진행중|
64|4.10|대표|신규영업: 신용 우량 거래처 한정 선점형 가격전략, 고마진 품목 병행 제안으로 수익구조 확보|기획영업부|진행중|
65|4.10|대표|기숙사 월 1회 안전점검·위생점검 연계 운영|경영지원센터|진행중|
66|4.17|부사장|소방 편제 현장 체류인원 중심으로 구성, 대피반·소화반·비상연락망 다음 주까지 종합 정리|경영지원센터|진행중|
67|4.17|부사장|소방 편제 확정 후 정기 교육·훈련 연계, 소방서 연계 합동훈련까지 순차 추진|전 부서|진행중|
68|4.17|부사장|층별·팀별 필수 인원 편제와 비상연락처 취합 제출, 리더는 소화전 위치·비상조치 순서 숙지|전 부서|진행중|
69|4.17|부사장|소화기 정기 점검 기준 마련 검토, 무게·상태 주기적 확인 체계 구축|경영지원센터|진행중|
70|4.17|부사장|감지기·전기설비 교체·보강 추진, 관련 견적 계속 검토|경영지원센터|진행중|
71|4.17|부사장|근생동·공장동 시설 위험요소 재점검 및 보강 우선순위 정리|경영지원센터|진행중|
72|4.17|부사장|관리자 대상 화재 초기대응 교육 실제 행동 위주로 반복 실시|전 부서|진행중|
73|4.17|부사장|저수조 청소 전 물 활용(청소·방수 연습 등) 계획 일정에 맞춰 사전 공유|경영지원센터|진행중|
74|4.17|부사장|도크 운영시간 전면 후행 이동 대신 병목 분산 중심으로 검토, 기사·영업·물류 실무 반영 별도 협의|기획영업부, 구매물류부|진행중|
75|4.17|부사장|주문 마감 1차/2차 발주 분리 방안 기획영업팀 실현가능성 먼저 검토, 1~2개 파트 시험 적용 여부 판단(월요일 10시 추가 논의)|기획영업부, 구매물류부|진행중|
76|4.17|부사장|경고 3회 이후 운영기준 취지 유지, 사면성 리셋 또는 상벌 연계형 보완방안 별도 지침 받아 검토|전 부서|진행중|
77|4.17|부사장|리더 공식석상 감정 배설성 발언 지양, 배려·명확성 중심 표현 기준 준수 재강조|전 부서|진행중|
$data$, E'\n') as line
  where btrim(line, E'\r') <> ''
),
source_rows as (
  select
    split_part(line, '|', 1)::int as source_no,
    split_part(line, '|', 2) as meeting_date_raw,
    split_part(line, '|', 3) as chair_role,
    split_part(line, '|', 4) as directive_text,
    split_part(line, '|', 5) as departments_raw,
    split_part(line, '|', 6) as status_ko,
    nullif(split_part(line, '|', 7), '') as note
  from source_lines
),
department_map(legacy_name, canonical_name) as (
  values
    ('기획영업부', '영업본부'),
    ('경영지원센터', '경영관리부'),
    ('HACCP', '햅썹운용팀'),
    ('구매물류부', '물류부'),
    ('육가공', '육가공팀')
),
active_departments as (
  select
    d.id,
    d.name,
    d.head_user_id,
    d.sort_order
  from public.departments d
  where d.is_active = true
),
normalized as (
  select
    s.*,
    split_part(s.meeting_date_raw, '.', 1)::int as meeting_month,
    split_part(s.meeting_date_raw, '.', 2)::int as meeting_day,
    row_number() over (
      partition by split_part(s.meeting_date_raw, '.', 1)::int
      order by s.source_no
    )::int as month_seq,
    case s.status_ko
      when '진행중' then 'IN_PROGRESS'
      else null
    end as status_en
  from source_rows s
),
prepared as (
  select
    n.source_no,
    n.departments_raw,
    n.month_seq,
    n.status_en,
    s.all_department_owner_name,
    format(
      'CN-%s-%s-%s',
      s.import_year,
      lpad(n.meeting_month::text, 2, '0'),
      lpad(n.month_seq::text, 3, '0')
    ) as directive_no,
    make_timestamptz(s.import_year, n.meeting_month, n.meeting_day, 9, 0, 0, 'Asia/Seoul') as assigned_at,
    case
      when n.departments_raw = '전 부서' then 'ALL'
      else 'SELECTED'
    end as target_scope
  from normalized n
  cross join settings s
),
selected_targets as (
  select
    p.directive_no,
    p.status_en,
    p.assigned_at,
    dep.ordinality::int as target_order,
    d.id as department_id,
    d.head_user_id as department_head_id
  from prepared p
  join lateral regexp_split_to_table(p.departments_raw, '\s*,\s*') with ordinality as dep(legacy_name, ordinality)
    on p.target_scope = 'SELECTED'
  join department_map m
    on m.legacy_name = trim(dep.legacy_name)
  join active_departments d
    on d.name = m.canonical_name
),
all_targets as (
  select
    p.directive_no,
    p.status_en,
    p.assigned_at,
    case
      when d.name = p.all_department_owner_name then 0
      else 1000 + row_number() over (
        partition by p.directive_no
        order by d.sort_order nulls last, d.name
      )
    end as target_order,
    d.id as department_id,
    d.head_user_id as department_head_id
  from prepared p
  join active_departments d
    on p.target_scope = 'ALL'
),
target_union as (
  select * from selected_targets
  union all
  select * from all_targets
),
target_departments as (
  select distinct on (u.directive_no, u.department_id)
    u.directive_no,
    u.status_en,
    u.assigned_at,
    u.target_order,
    u.department_id,
    u.department_head_id
  from target_union u
  order by u.directive_no, u.department_id, u.target_order
),
target_with_primary as (
  select
    t.*,
    min(t.target_order) over (partition by t.directive_no) as primary_target_order
  from target_departments t
),
target_plan as (
  select
    t.directive_no,
    t.status_en,
    t.assigned_at,
    t.department_id,
    t.department_head_id,
    (t.target_order = t.primary_target_order) as is_primary,
    case
      when t.target_order = t.primary_target_order then 'OWNER'
      else 'SUPPORT'
    end as assignment_role
  from target_with_primary t
)
insert into public.directive_departments as dd (
  id,
  directive_id,
  department_id,
  department_head_id,
  department_status,
  assigned_at,
  department_due_date,
  department_closed_at,
  created_at,
  updated_at,
  is_primary,
  assignment_role
)
select
  gen_random_uuid(),
  d.id,
  t.department_id,
  t.department_head_id,
  t.status_en,
  t.assigned_at,
  null,
  null,
  t.assigned_at,
  t.assigned_at,
  t.is_primary,
  t.assignment_role
from target_plan t
join public.directives d
  on d.directive_no = t.directive_no
on conflict (directive_id, department_id) do update
set
  department_head_id = excluded.department_head_id,
  is_primary = excluded.is_primary,
  assignment_role = excluded.assignment_role;
