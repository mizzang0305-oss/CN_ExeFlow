-- CN EXEFLOW 초기 지시사항 77건 이관
-- Dry run:
-- 1. SQL Editor에서 이 스크립트를 수동 실행합니다.
-- 2. 같은 DB에서 supabase/scripts/cn_directives_import_validation.sql 을 실행해 결과를 확인합니다.
-- 3. 쓰기 없는 검증이 필요하면 마지막 COMMIT 을 ROLLBACK 으로 바꿔 실행합니다.
--
-- 현재 운영 스키마에는 instructed_at / source_type / priority 컬럼이 없습니다.
-- 아래 스크립트는 created_at 을 회의일 기준 시각으로 사용하고,
-- source_type=MEETING / priority=MEDIUM / 원본 메타데이터는 directives.content 의
-- [원본이관정보] 블록에 보존합니다.
--
-- 레거시 부서명 -> 현재 활성 부서 매핑
-- - 기획영업부 -> 영업본부
-- - 경영지원센터 -> 경영관리부
-- - HACCP -> 햅썹운용팀
-- - 구매물류부 -> 물류부
-- - 육가공 -> 육가공팀
-- - 전 부서 -> 현재 departments 테이블의 모든 활성 부서

begin;

create extension if not exists pgcrypto;

create temp table tmp_cn_directive_import (
  source_no int not null,
  meeting_date_raw text not null,
  chair_role text not null,
  directive_text text not null,
  departments_raw text not null,
  status_ko text not null,
  note text null
) on commit drop;

insert into tmp_cn_directive_import (
  source_no,
  meeting_date_raw,
  chair_role,
  directive_text,
  departments_raw,
  status_ko,
  note
) values
  (1, '3.06', '대표', '영업 방향 전환 : 주문접수형 → 점유율 확대형 영업으로 강화', '기획영업부', '진행중', null),
  (2, '3.06', '대표', '미사용 거래처·방어필요 지역 한정 전략 단가 운영(전체 인하 금지)', '기획영업부', '진행중', null),
  (3, '3.06', '대표', '경쟁력 품목(오징어채·김치 등) 샘플 제안·방문·한시행사로 사용 전환 추진', '기획영업부', '진행중', null),
  (4, '3.06', '대표', '품질·활용법·조리결과 사진 활용한 설명형·제안형 영업 방식 확대', '기획영업부', '진행중', null),
  (5, '3.06', '대표', '신규 상품·대체 품목 피드백 일 단위 점검·보고(부장/차장급 주도)', '전 부서', '진행중', null),
  (6, '3.06', '대표', '장기적으로 브랜드 신뢰 구축 중심 영업 방향 강화(씨엔푸드·쿠킹데이)', '기획영업부', '진행중', null),
  (7, '3.06', '부사장', '상품·물류 실무인력 채용 예정대로 진행, 야간 관리자·외국인 실무인력 추가 채용 검토', '경영지원센터', '진행중', null),
  (8, '3.06', '부사장', '채용은 단순 충원 아닌 성과 확대+인력 재편 전제로 운영, 채용과 동시 평가·피드백 체계 구축', '경영지원센터', '진행중', null),
  (9, '3.06', '부사장', 'HACCP: 주니어 1명 채용+센터장 대행+외부 고문 활용 방향 검토, 세부 운영 추가 논의 후 확정', 'HACCP', '진행중', null),
  (10, '3.06', '부사장', '영업 매니저 월 1명씩 보강, 파트장급은 적합 인원 확보 시까지 면접 지속', '기획영업부', '진행중', null),
  (11, '3.06', '부사장', '채권관리 핵심 목표: 약정일 100% 회수 설정, 채권팀·영업·경영지원 공동 프로세스 정비', '경영지원센터', '진행중', null),
  (12, '3.06', '부사장', '카드수수료 절감 위해 통장입금 등 현금성 수금 확대 방향 검토', '기획영업부', '진행중', null),
  (13, '3.06', '부사장', '영업 단가·마진 운영 권한 기준·선조치·사후품의 기준 문서화', '기획영업부', '진행중', null),
  (14, '3.06', '부사장', '카택스 3월 말까지 계도기간 운영, 이후 기준 미준수 시 지급 제외 등 통제 강화', '전 부서', '진행중', null),
  (15, '3.06', '부사장', '회의 내용 문서화 후 하이웍스 등 공식 기록으로 축적, 관리자 대상 기준 교육 강화', '전 부서', '진행중', null),
  (16, '3.20', '대표', '팀 운영·관리자 역할 점검: 회사 기준대로 업무 운영 여부 확인 체계 구축', '전 부서', '진행중', null),
  (17, '3.20', '대표', '부서별 월간 보고 및 평가표 작성 체계 재점검(7월 성과급 평가 반영)', '전 부서', '진행중', null),
  (18, '3.20', '대표', '물류팀 보고·평가 체계 이번 주 내 정리(조광수부장·최수용과장·유숙현팀장 협의)', '구매물류부', '진행중', null),
  (19, '3.20', '대표', '연구소 공간 전환 및 세제혜택 확보 추진(2층 휴게소 활용 검토)', '경영지원센터', '진행중', null),
  (20, '3.20', '대표', '김치류 샘플 100~200박스 적극 배포·공격적 홍보 추진', '기획영업부, 구매물류부', '진행중', null),
  (21, '3.20', '대표', '퇴사자(신대규 팀장) 업무 인수인계 누락사항 파악 및 정리', '경영지원센터', '진행중', null),
  (22, '3.20', '부사장', '박하지 꽃게 악성재고 4월 중 단기 특판 방식 집중 소진 추진(4~5천원 특판)', '기획영업부, 구매물류부', '진행중', null),
  (23, '3.20', '부사장', '국산 고등어 재고 품질 재점검 후 별도 처리방안 수립(사료전환·선별·폐기 순차 검토)', '구매물류부', '진행중', null),
  (24, '3.20', '부사장', '영업 협조 유도: 회사 전략품목 판매 기여도·협조도를 평가 항목에 반영', '기획영업부', '진행중', null),
  (25, '3.20', '부사장', '상품 운영 실패사례 백서 체계 마련(구매배경·판매경과·문제원인·결과·시사점 기록)', '기획영업부', '진행중', null),
  (26, '3.20', '부사장', '향후 회의 시 악성재고·부진재고 진행현황 정례 보고 운영', '전 부서', '진행중', null),
  (27, '3.20', '부사장', '향후 악성재고 보고는 의사결정형 보고체계로 전환(손실규모·보완책·시장영향 포함)', '전 부서', '진행중', null),
  (28, '3.22', '대표', '악성재고 조기 처리 원칙 운영: 행사·대체용도 판매, 필요 시 손실 감수 정리', '기획영업부, 구매물류부', '진행중', null),
  (29, '3.22', '대표', '샘플링 후 결과 회신 및 채택 여부 신속 결정 기준 마련', '전 부서', '진행중', null),
  (30, '3.22', '대표', '기존 거래처 품목 점유율 확대를 핵심 과제로 관리(A급 거래처 집중 추진)', '기획영업부', '진행중', null),
  (31, '3.22', '대표', '주간 보고 및 실적관리표 체계화(신규·품목확대·수금·방문 결과 표준 양식 정비)', '전 부서', '진행중', null),
  (32, '3.22', '대표', '성과 인정 기준 명확화: 결과 중심 관리, 하는 사람과 하지 않는 사람 구분', '전 부서', '진행중', null),
  (33, '3.22', '대표', '전략팀·신규개발팀 영업지원·수익성 데이터 제공 기능 보강', '기획영업부', '진행중', null),
  (34, '3.22', '대표', '거래처 핵심 인물(주방장·실장·사장) 관계영업 신뢰 형성 및 정보 확보 강화', '기획영업부', '진행중', null),
  (35, '3.27', '부사장', '야간 운영: 당직자 중심 보완체계 우선 운영, 기획팀 로테이션 야간 당직 1명 배치', '기획영업부', '진행중', null),
  (36, '3.27', '부사장', '도크·출고시간 조정은 일부 대상부터 순차 검토(영업총괄 박정민 차장 협의)', '기획영업부, 구매물류부', '진행중', null),
  (37, '3.27', '부사장', '육가공·수산 신제품 입고 시 HACCP 통보 및 보고·서류 확보 절차 정비 후 전파', '구매물류부, HACCP', '진행중', null),
  (38, '3.27', '부사장', '해동 제품 해동중 표시·해동실 사용·온도유지 기준 재강조, 개봉 해동 금지 방향 계도', '전 부서', '진행중', null),
  (39, '3.27', '부사장', '부진재고 선공지 원칙 관리, 박하지 가격 확정 후 대표 보고, 단호박 원물 판매 중단 후 가공·외부처리 검토', '구매물류부', '진행중', null),
  (40, '3.27', '부사장', '청소인력 관련: 질서 위반 인원 TF 조사·징계위원회 회부 검토, 리더 중심 기본 태도 교육 즉시 강화', '전 부서', '진행중', null),
  (41, '3.27', '부사장', '부서별 청소 임시 담당구역 지정 운영(월:경영지원센터, 화:기획영업부, 수:구매물류부)', '전 부서', '진행중', null),
  (42, '4.03', '부사장', '주간회의 일반 현황공유보다 의사결정·이슈해결 중심으로 운영, 단순 공유사항은 사전 전달', '전 부서', '진행중', null),
  (43, '4.03', '부사장', '4월 영업: 주차별 행사·물량 배분 중심 운영, 가격인상·비용상승 변수 반영 관리', '기획영업부', '진행중', null),
  (44, '4.03', '부사장', '수산물 해동 원칙적 금지 방향 관리, 거래처 D+2 선주문 체계 유도', '전 부서', '진행중', null),
  (45, '4.03', '부사장', '해동 요청 현행 카톡방식 유지, 업체명·상품명·대표자명 핵심정보 기재 강화 및 현장 표기 보완', '전 부서', '진행중', null),
  (46, '4.03', '부사장', '클레임 관리대장·이물 대응 기준 영업부 협의 후 매뉴얼 형태 정리(4단계 유형화)', '전 부서', '진행중', null),
  (47, '4.03', '부사장', '작업 닭다리 재고 내부 처리 한계 고려, 외주 활용 포함 실행방안 추진(4월 말까지 약 30톤)', '기획영업부, 구매물류부', '진행중', null),
  (48, '4.03', '부사장', '갈비탕용 등 추가 수요 품목 시세·작업여건 확인 후 리스트화 검토', '육가공', '진행중', null),
  (49, '4.03', '부사장', '시설 안전 문제 비교견적 및 즉시 공유체계 통해 조치속도 높임', '경영지원센터', '진행중', null),
  (50, '4.03', '부사장', '품질 개선 재고 품목(열빙어 등) 영업 관심품목으로 관리, 자연출고·추가판매 유도', '기획영업부', '진행중', null),
  (51, '4.03', '부사장', '랩비닐 등 부자재 추가 확보와 절약 운영 병행(홍보 캠페인·공문 작성 검토)', '전 부서', '진행중', null),
  (52, '4.10', '대표', '부진재고 자연소진보다 행사 중심 소진전략 우선 적용', '기획영업부, 구매물류부', '진행중', null),
  (53, '4.10', '대표', '판매집중 품목(미국북채·붕어빵류·돌돌말이대패삼겹살 등) 영업부·기획팀 공격적 판매 추진', '기획영업부', '진행중', null),
  (54, '4.10', '대표', '반응 좋은 신상품 지속 운영, 특식 제안·사진자료 등 판매지원 요소 강화', '기획영업부', '진행중', null),
  (55, '4.10', '대표', '박스 개봉 해동 금주 계도 후 다음 주부터 전면 중단, 불가피 해동은 통제된 내부공간만 운영', '전 부서', '진행중', null),
  (56, '4.10', '대표', '해동 관련 거래처 안내문구·계도자료 최신 근거자료 기준으로 정리, 영업·물류 동일 기준 공유', '전 부서', '진행중', null),
  (57, '4.10', '대표', '건물관리 공백 대비 대체 인력 또는 후속 대응체계 검토', '경영지원센터', '진행중', null),
  (58, '4.10', '대표', '공구·비품 보관공간 잠금 운영 유지, 열쇠 지정장소 보관 및 사용기록·원위치 원칙 강화', '경영지원센터', '진행중', null),
  (59, '4.10', '대표', '저수조 청소 4/17 공장동·4/19~20 근생동 일정 연계 추진, 사전 사용량 계산 및 공급조절 협의', '경영지원센터', '진행중', null),
  (60, '4.10', '대표', '냉동고 열선 공사 시 출입통제·양생시간 준수 강하게 적용하여 재손상 방지', '경영지원센터', '진행중', null),
  (61, '4.10', '대표', '냉동창고 결로·전기위험 문제 송풍·제습·전기보완과 감지기 개선안 병행 검토, 최신 기준 재확인 후 결정', '경영지원센터', '진행중', null),
  (62, '4.10', '대표', '지게차 속도 저감·현장 안전계도 강화하여 시설보강 효과가 실제 안전으로 이어지도록 관리', '전 부서', '진행중', null),
  (63, '4.10', '대표', '인력평가·조기승진 공식 추천 및 명확한 평가기준 전제 운영(추천 월요일까지 취합)', '전 부서', '진행중', null),
  (64, '4.10', '대표', '신규영업: 신용 우량 거래처 한정 선점형 가격전략, 고마진 품목 병행 제안으로 수익구조 확보', '기획영업부', '진행중', null),
  (65, '4.10', '대표', '기숙사 월 1회 안전점검·위생점검 연계 운영', '경영지원센터', '진행중', null),
  (66, '4.17', '부사장', '소방 편제 현장 체류인원 중심으로 구성, 대피반·소화반·비상연락망 다음 주까지 종합 정리', '경영지원센터', '진행중', null),
  (67, '4.17', '부사장', '소방 편제 확정 후 정기 교육·훈련 연계, 소방서 연계 합동훈련까지 순차 추진', '전 부서', '진행중', null),
  (68, '4.17', '부사장', '층별·팀별 필수 인원 편제와 비상연락처 취합 제출, 리더는 소화전 위치·비상조치 순서 숙지', '전 부서', '진행중', null),
  (69, '4.17', '부사장', '소화기 정기 점검 기준 마련 검토, 무게·상태 주기적 확인 체계 구축', '경영지원센터', '진행중', null),
  (70, '4.17', '부사장', '감지기·전기설비 교체·보강 추진, 관련 견적 계속 검토', '경영지원센터', '진행중', null),
  (71, '4.17', '부사장', '근생동·공장동 시설 위험요소 재점검 및 보강 우선순위 정리', '경영지원센터', '진행중', null),
  (72, '4.17', '부사장', '관리자 대상 화재 초기대응 교육 실제 행동 위주로 반복 실시', '전 부서', '진행중', null),
  (73, '4.17', '부사장', '저수조 청소 전 물 활용(청소·방수 연습 등) 계획 일정에 맞춰 사전 공유', '경영지원센터', '진행중', null),
  (74, '4.17', '부사장', '도크 운영시간 전면 후행 이동 대신 병목 분산 중심으로 검토, 기사·영업·물류 실무 반영 별도 협의', '기획영업부, 구매물류부', '진행중', null),
  (75, '4.17', '부사장', '주문 마감 1차/2차 발주 분리 방안 기획영업팀 실현가능성 먼저 검토, 1~2개 파트 시험 적용 여부 판단(월요일 10시 추가 논의)', '기획영업부, 구매물류부', '진행중', null),
  (76, '4.17', '부사장', '경고 3회 이후 운영기준 취지 유지, 사면성 리셋 또는 상벌 연계형 보완방안 별도 지침 받아 검토', '전 부서', '진행중', null),
  (77, '4.17', '부사장', '리더 공식석상 감정 배설성 발언 지양, 배려·명확성 중심 표현 기준 준수 재강조', '전 부서', '진행중', null);

create temp table tmp_cn_directive_import_settings (
  import_year int not null,
  import_batch text not null,
  all_department_owner_name text not null
) on commit drop;

insert into tmp_cn_directive_import_settings (
  import_year,
  import_batch,
  all_department_owner_name
) values (
  2025,
  'CN_INITIAL_IMPORT_77',
  '주식회사 씨엔푸드'
);

create temp table tmp_cn_legacy_department_map (
  legacy_name text primary key,
  canonical_name text not null
) on commit drop;

insert into tmp_cn_legacy_department_map (
  legacy_name,
  canonical_name
) values
  ('기획영업부', '영업본부'),
  ('경영지원센터', '경영관리부'),
  ('HACCP', '햅썹운용팀'),
  ('구매물류부', '물류부'),
  ('육가공', '육가공팀');

create temp table tmp_cn_directive_prepared on commit drop as
with normalized as (
  select
    t.source_no,
    t.meeting_date_raw,
    t.chair_role,
    t.directive_text,
    t.departments_raw,
    t.status_ko,
    nullif(btrim(t.note), '') as note,
    split_part(t.meeting_date_raw, '.', 1)::int as meeting_month,
    split_part(t.meeting_date_raw, '.', 2)::int as meeting_day,
    row_number() over (
      partition by split_part(t.meeting_date_raw, '.', 1)::int
      order by t.source_no
    ) as month_seq,
    case t.status_ko
      when '신규' then 'NEW'
      when '진행중' then 'IN_PROGRESS'
      when '완료요청' then 'COMPLETION_REQUESTED'
      when '지연' then 'DELAYED'
      when '완료' then 'COMPLETED'
      when '반려' then 'REJECTED'
      else null
    end as status_en
  from tmp_cn_directive_import t
)
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
cross join tmp_cn_directive_import_settings s;

create temp table tmp_cn_directive_target_departments on commit drop as
with active_departments as (
  select
    d.id,
    d.name,
    d.head_user_id,
    d.sort_order
  from public.departments d
  where d.is_active = true
),
selected_targets as (
  select
    p.source_no,
    p.directive_no,
    p.status_en,
    p.directive_created_at as assigned_at,
    p.target_scope,
    dep.ordinality::int as target_order,
    d.id as department_id,
    d.name as department_name,
    d.head_user_id as department_head_id
  from tmp_cn_directive_prepared p
  join lateral regexp_split_to_table(p.departments_raw, '\s*,\s*') with ordinality as dep(legacy_name, ordinality)
    on p.target_scope = 'SELECTED'
  join tmp_cn_legacy_department_map m
    on m.legacy_name = trim(dep.legacy_name)
  join active_departments d
    on d.name = m.canonical_name
),
all_targets as (
  select
    p.source_no,
    p.directive_no,
    p.status_en,
    p.directive_created_at as assigned_at,
    p.target_scope,
    case
      when d.name = s.all_department_owner_name then 0
      else 1000 + row_number() over (
        partition by p.directive_no
        order by d.sort_order nulls last, d.name
      )
    end as target_order,
    d.id as department_id,
    d.name as department_name,
    d.head_user_id as department_head_id
  from tmp_cn_directive_prepared p
  cross join tmp_cn_directive_import_settings s
  join active_departments d
    on p.target_scope = 'ALL'
),
unioned as (
  select * from selected_targets
  union all
  select * from all_targets
),
deduped as (
  select distinct on (u.directive_no, u.department_id)
    u.source_no,
    u.directive_no,
    u.department_id,
    u.department_name,
    u.department_head_id,
    u.status_en,
    u.assigned_at,
    u.target_scope,
    u.target_order
  from unioned u
  order by u.directive_no, u.department_id, u.target_order
),
ranked as (
  select
    d.*,
    min(d.target_order) over (partition by d.directive_no) as primary_target_order
  from deduped d
)
select
  r.source_no,
  r.directive_no,
  r.department_id,
  r.department_name,
  r.department_head_id,
  r.status_en,
  r.assigned_at,
  r.target_scope,
  r.target_order,
  (r.target_order = r.primary_target_order) as is_primary,
  case
    when r.target_order = r.primary_target_order then 'OWNER'
    else 'SUPPORT'
  end as assignment_role
from ranked r;

create temp table tmp_cn_directive_resolved on commit drop as
with mapped_names as (
  select
    t.directive_no,
    string_agg(t.department_name, ', ' order by t.target_order, t.department_name) as mapped_department_names
  from tmp_cn_directive_target_departments t
  group by t.directive_no
),
active_counts as (
  select count(*)::int as active_department_count
  from public.departments
  where is_active = true
)
select
  p.source_no,
  p.meeting_date_raw,
  p.chair_role,
  p.directive_text,
  p.departments_raw,
  p.status_ko,
  p.note,
  p.meeting_month,
  p.meeting_day,
  p.month_seq,
  p.import_year,
  p.import_batch,
  p.directive_no,
  p.year_month,
  p.directive_created_at as created_at,
  p.target_scope,
  p.status_en,
  o.department_id as owner_department_id,
  o.department_name as owner_department_name,
  m.mapped_department_names,
  a.active_department_count
from tmp_cn_directive_prepared p
left join tmp_cn_directive_target_departments o
  on o.directive_no = p.directive_no
 and o.is_primary = true
left join mapped_names m
  on m.directive_no = p.directive_no
cross join active_counts a;

do $$
declare
  v_import_year int;
  v_import_batch text;
  v_all_department_owner_name text;
  v_import_user_id uuid;
  v_import_user_email text;
  v_expected_assignment_count int;
  v_planned_directive_count int;
  v_conflict_count int;
  v_duplicate_directive_no_count int;
  v_missing_owner_count int;
begin
  select
    s.import_year,
    s.import_batch,
    s.all_department_owner_name
  into
    v_import_year,
    v_import_batch,
    v_all_department_owner_name
  from tmp_cn_directive_import_settings s;

  select
    u.id,
    u.email
  into
    v_import_user_id,
    v_import_user_email
  from public.users u
  where u.is_active = true
    and u.role in ('CEO', 'SUPER_ADMIN')
  order by
    case when u.role = 'CEO' then 0 else 1 end,
    u.name
  limit 1;

  if v_import_user_id is null then
    raise exception 'CN import blocked: active CEO/SUPER_ADMIN account not found for created_by.';
  end if;

  if exists (
    select 1
    from tmp_cn_directive_prepared p
    where p.status_en is null
  ) then
    raise exception 'CN import blocked: unsupported status_ko found in source data.';
  end if;

  if exists (
    select 1
    from (
      select trim(dep.legacy_name) as legacy_name
      from tmp_cn_directive_prepared p
      join lateral regexp_split_to_table(p.departments_raw, '\s*,\s*') as dep(legacy_name)
        on p.target_scope = 'SELECTED'
    ) x
    left join tmp_cn_legacy_department_map m
      on m.legacy_name = x.legacy_name
    where m.legacy_name is null
  ) then
    raise exception 'CN import blocked: unmapped legacy department label found in source data.';
  end if;

  if exists (
    select 1
    from tmp_cn_legacy_department_map m
    left join public.departments d
      on d.name = m.canonical_name
     and d.is_active = true
    where d.id is null
  ) then
    raise exception 'CN import blocked: one or more mapped canonical departments do not exist as active departments.';
  end if;

  if not exists (
    select 1
    from public.departments d
    where d.name = v_all_department_owner_name
      and d.is_active = true
  ) then
    raise exception 'CN import blocked: all-department primary owner "%" is not an active department.', v_all_department_owner_name;
  end if;

  select count(*)
  into v_planned_directive_count
  from tmp_cn_directive_resolved;

  if v_planned_directive_count <> 77 then
    raise exception 'CN import blocked: expected 77 directives, prepared % directives.', v_planned_directive_count;
  end if;

  select count(*)
  into v_duplicate_directive_no_count
  from (
    select r.directive_no
    from tmp_cn_directive_resolved r
    group by r.directive_no
    having count(*) > 1
  ) duplicates;

  if v_duplicate_directive_no_count > 0 then
    raise exception 'CN import blocked: duplicate directive_no generated in prepared data.';
  end if;

  select count(*)
  into v_missing_owner_count
  from tmp_cn_directive_resolved r
  where r.owner_department_id is null;

  if v_missing_owner_count > 0 then
    raise exception 'CN import blocked: prepared owner_department_id is null for % directives.', v_missing_owner_count;
  end if;

  select
    sum(
      case
        when r.target_scope = 'ALL' then r.active_department_count
        else cardinality(regexp_split_to_array(r.departments_raw, '\s*,\s*'))
      end
    )::int
  into v_expected_assignment_count
  from tmp_cn_directive_resolved r;

  if (
    select count(*)
    from tmp_cn_directive_target_departments t
  ) <> v_expected_assignment_count then
    raise exception
      'CN import blocked: expected % directive_departments rows, prepared % rows.',
      v_expected_assignment_count,
      (select count(*) from tmp_cn_directive_target_departments);
  end if;

  if exists (
    select 1
    from tmp_cn_directive_target_departments t
    group by t.directive_no
    having count(*) filter (where t.is_primary) <> 1
  ) then
    raise exception 'CN import blocked: each directive must have exactly one primary department.';
  end if;

  select count(*)
  into v_conflict_count
  from tmp_cn_directive_resolved r
  join public.directives d
    on d.directive_no = r.directive_no
  where d.content not like '%' || v_import_batch || '%';

  if v_conflict_count > 0 then
    raise exception
      'CN import blocked: found % directive_no collisions with non-import rows for year %.',
      v_conflict_count,
      v_import_year;
  end if;

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
    v_import_user_id,
    r.created_at,
    r.owner_department_id,
    null,
    false,
    r.target_scope
  from tmp_cn_directive_resolved r
  on conflict (directive_no) do update
  set
    title = excluded.title,
    content = excluded.content,
    year_month = excluded.year_month,
    sequence = excluded.sequence,
    owner_department_id = excluded.owner_department_id,
    target_scope = excluded.target_scope;

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
  from tmp_cn_directive_target_departments t
  join public.directives d
    on d.directive_no = t.directive_no
  on conflict (directive_id, department_id) do update
  set
    department_head_id = excluded.department_head_id,
    is_primary = excluded.is_primary,
    assignment_role = excluded.assignment_role;

  raise notice 'CN import ready: year=% batch=% created_by=% (%).', v_import_year, v_import_batch, v_import_user_id, v_import_user_email;
end $$;

commit;
