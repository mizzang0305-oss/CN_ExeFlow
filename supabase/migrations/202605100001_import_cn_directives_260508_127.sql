-- CN EXEFLOW 2026-05-08 directive data replace (127 rows)
-- Source workbook: 260508 directive workbook
-- Source sheets: CEO directives (45), VP directives (82)
-- Validation sheet is auxiliary only because it misses VP No.63.
--
-- Rules:
-- - Archive existing active directives instead of hard deleting them.
-- - Excel 지속 is a report bucket, not a workflow status.
-- - Internal workflow status remains IN_PROGRESS or COMPLETED for this import.
-- - 전 부서 stays one assignment group and is not expanded to all departments.

create extension if not exists pgcrypto;

do $$
declare
  v_import_year int;
  v_import_batch text;
  v_archive_reason text;
  v_import_user_id uuid;
  v_import_user_email text;
  v_archived_at timestamptz := now();
  v_archive_suffix text;
  v_planned_directive_count int;
  v_expected_assignment_count int := 144;
  v_archived_directive_count int;
begin

drop table if exists
  tmp_cn_directive_260508_resolved,
  tmp_cn_directive_260508_target_departments,
  tmp_cn_directive_260508_prepared,
  tmp_cn_directive_260508_expected_departments,
  tmp_cn_directive_260508_department_map,
  tmp_cn_directive_260508_settings,
  tmp_cn_directive_260508_import;

create temp table tmp_cn_directive_260508_import (
  source_order int not null,
  source_sheet text not null,
  source_no int not null,
  meeting_date date not null,
  chair_role text not null,
  directive_text text not null,
  departments_raw text not null,
  report_departments text not null,
  status_ko text not null,
  report_bucket text not null,
  note text null,
  due_date date null
) on commit preserve rows;

insert into tmp_cn_directive_260508_import (
  source_order,
  source_sheet,
  source_no,
  meeting_date,
  chair_role,
  directive_text,
  departments_raw,
  report_departments,
  status_ko,
  report_bucket,
  note,
  due_date
) values
  (1, '대표이사 지시사항', 1, '2026-03-06', '대표', '영업 방향 전환 : 주문접수형 → 점유율 확대형 영업으로 강화', '기획영업부', '기획영업부', '지속', '지속', null, null),
  (2, '대표이사 지시사항', 2, '2026-03-06', '대표', '미사용 거래처·방어필요 지역 한정 전략 단가 운영(전체 인하 금지)', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (3, '대표이사 지시사항', 3, '2026-03-06', '대표', '경쟁력 품목(오징어채·김치 등) 샘플 제안·방문·한시행사로 사용 전환 추진', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (4, '대표이사 지시사항', 4, '2026-03-06', '대표', '품질·활용법·조리결과 사진 활용한 설명형·제안형 영업 방식 확대', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (5, '대표이사 지시사항', 5, '2026-03-06', '대표', '신규 상품·대체 품목 피드백 일 단위 점검·보고(부장/차장급 주도)', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (6, '대표이사 지시사항', 6, '2026-03-06', '대표', '장기적으로 브랜드 신뢰 구축 중심 영업 방향 강화(씨엔푸드·쿠킹데이)', '기획영업부', '기획영업부', '지속', '지속', null, null),
  (7, '대표이사 지시사항', 7, '2026-03-20', '대표', '팀 운영·관리자 역할 점검: 회사 기준대로 업무 운영 여부 확인 체계 구축', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (8, '대표이사 지시사항', 8, '2026-03-20', '대표', '부서별 월간 보고 및 평가표 작성 체계 재점검(7월 성과급 평가 반영)', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (9, '대표이사 지시사항', 9, '2026-03-20', '대표', '물류팀 보고·평가 체계 이번 주 내 정리(조광수부장·최수용과장·유숙현팀장 협의)', '구매물류부', '구매물류부', '완료', '완료', null, null),
  (10, '대표이사 지시사항', 10, '2026-03-20', '대표', '연구소 공간 전환 및 세제혜택 확보 추진(2층 휴게소 활용 검토)', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (11, '대표이사 지시사항', 11, '2026-03-20', '대표', '김치류 샘플 100~200박스 적극 배포·공격적 홍보 추진', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '완료', '완료', null, null),
  (12, '대표이사 지시사항', 12, '2026-03-20', '대표', '퇴사자(신대규 팀장) 업무 인수인계 누락사항 파악 및 정리', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (13, '대표이사 지시사항', 13, '2026-03-22', '대표', '악성재고 조기 처리 원칙 운영: 행사·대체용도 판매, 필요 시 손실 감수 정리', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (14, '대표이사 지시사항', 14, '2026-03-22', '대표', '샘플링 후 결과 회신 및 채택 여부 신속 결정 기준 마련', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (15, '대표이사 지시사항', 15, '2026-03-22', '대표', '기존 거래처 품목 점유율 확대를 핵심 과제로 관리(A급 거래처 집중 추진)', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (16, '대표이사 지시사항', 16, '2026-03-22', '대표', '주간 보고 및 실적관리표 체계화(신규·품목확대·수금·방문 결과 표준 양식 정비)', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (17, '대표이사 지시사항', 17, '2026-03-22', '대표', '성과 인정 기준 명확화: 결과 중심 관리, 하는 사람과 하지 않는 사람 구분', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (18, '대표이사 지시사항', 18, '2026-03-22', '대표', '전략팀·신규개발팀 영업지원·수익성 데이터 제공 기능 보강', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (19, '대표이사 지시사항', 19, '2026-03-22', '대표', '거래처 핵심 인물(주방장·실장·사장) 관계영업 신뢰 형성 및 정보 확보 강화', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (20, '대표이사 지시사항', 20, '2026-04-10', '대표', '부진재고 자연소진보다 행사 중심 소진전략 우선 적용', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (21, '대표이사 지시사항', 21, '2026-04-10', '대표', '판매집중 품목(미국북채·붕어빵류·돌돌말이대패삼겹살 등) 영업부·기획팀 공격적 판매 추진', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (22, '대표이사 지시사항', 22, '2026-04-10', '대표', '반응 좋은 신상품 지속 운영, 특식 제안·사진자료 등 판매지원 요소 강화', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (23, '대표이사 지시사항', 23, '2026-04-10', '대표', '박스 개봉 해동 금주 계도 후 다음 주부터 전면 중단, 불가피 해동은 통제된 내부공간만 운영', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (24, '대표이사 지시사항', 24, '2026-04-10', '대표', '해동 관련 거래처 안내문구·계도자료 최신 근거자료 기준으로 정리, 영업·물류 동일 기준 공유', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (25, '대표이사 지시사항', 25, '2026-04-10', '대표', '건물관리 공백 대비 대체 인력 또는 후속 대응체계 검토', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (26, '대표이사 지시사항', 26, '2026-04-10', '대표', '공구·비품 보관공간 잠금 운영 유지, 열쇠 지정장소 보관 및 사용기록·원위치 원칙 강화', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (27, '대표이사 지시사항', 27, '2026-04-10', '대표', '저수조 청소 4/17 공장동·4/19~20 근생동 일정 연계 추진, 사전 사용량 계산 및 공급조절 협의', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (28, '대표이사 지시사항', 28, '2026-04-10', '대표', '냉동고 열선 공사 시 출입통제·양생시간 준수 강하게 적용하여 재손상 방지', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (29, '대표이사 지시사항', 29, '2026-04-10', '대표', '냉동창고 결로·전기위험 문제 송풍·제습·전기보완과 감지기 개선안 병행 검토, 최신 기준 재확인 후 결정', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (30, '대표이사 지시사항', 30, '2026-04-10', '대표', '지게차 속도 저감·현장 안전계도 강화하여 시설보강 효과가 실제 안전으로 이어지도록 관리', '전 부서', '전 부서', '완료', '완료', null, null),
  (31, '대표이사 지시사항', 31, '2026-04-10', '대표', '인력평가·조기승진 공식 추천 및 명확한 평가기준 전제 운영(추천 월요일까지 취합)', '전 부서', '전 부서', '완료', '완료', null, null),
  (32, '대표이사 지시사항', 32, '2026-04-10', '대표', '신규영업: 신용 우량 거래처 한정 선점형 가격전략, 고마진 품목 병행 제안으로 수익구조 확보', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (33, '대표이사 지시사항', 33, '2026-04-10', '대표', '기숙사 월 1회 안전점검·위생점검 연계 운영', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (34, '대표이사 지시사항', 34, '2026-05-08', '대표', '인도네시아산 카사바 샘플 수령 후 국내 시장 테스트 추진(튀김·삶음·샐러드 등 조리 활용)', '구매물류부', '구매물류부', '진행중', '진행중', '5월 중순', null),
  (35, '대표이사 지시사항', 35, '2026-05-08', '대표', '모닝글로리(공심채) 냉동 글로벌 제품 샘플 수령 및 식감·볶음 테스트', '구매물류부', '구매물류부', '진행중', '진행중', '5월 중순', null),
  (36, '대표이사 지시사항', 36, '2026-05-08', '대표', '인도네시아산 갈치 입고(19일 전후) 후 사이즈별(200~300g) 코드 이원화 및 가격 차등 운영(상품·일반 분리)', '구매물류부', '구매물류부', '진행중', '진행중', '5/19 전후', null),
  (37, '대표이사 지시사항', 37, '2026-05-08', '대표', '자우지(중국식 만두) 샘플 공항 수령 후 사내 식감 테스트 진행 및 도입 검토', '구매물류부', '구매물류부', '진행중', '진행중', '5/11', '2026-05-11'),
  (38, '대표이사 지시사항', 38, '2026-05-08', '대표', '미국산 가자미 인도네시아 가공 수입 루트 확보 지속 탐색', '구매물류부', '구매물류부', '지속', '지속', '지속', null),
  (39, '대표이사 지시사항', 39, '2026-05-08', '대표', '중국산 가공 돼지고기(삶은 것, FTA 미체결로 가공품만 가능) 수입 가능성 검토', '구매물류부', '구매물류부', '진행중', '진행중', '5월 중', null),
  (40, '대표이사 지시사항', 40, '2026-05-08', '대표', '국내 영업 서울·경기 집중 강화, 지방 비효율 거래처 정리 방향 수립', '기획영업부', '기획영업부', '진행중', '진행중', '5월 말', null),
  (41, '대표이사 지시사항', 41, '2026-05-08', '대표', '5월 말 월 매출 미수 90억원 목표 달성 - 미수 밀착 관리 강화(100억 초과 시 운영비·이자 부담 급증 방지)', '기획영업부, 경영관리센터', '기획영업부, 경영관리센터', '진행중', '진행중', '5/31', '2026-05-31'),
  (42, '대표이사 지시사항', 42, '2026-05-08', '대표', '미수 장기 미해소 대리점·업체 거래 중단 원칙 재공지 및 이행', '경영관리센터', '경영관리센터', '진행중', '진행중', '즉시', null),
  (43, '대표이사 지시사항', 43, '2026-05-08', '대표', '대형 거래처(월 미수 500만원↑) 미수 현황 센터장 직접 모니터링 체계 구축', '경영관리센터', '경영관리센터', '진행중', '진행중', '즉시', null),
  (44, '대표이사 지시사항', 44, '2026-05-08', '대표', '전 세계 식재료 공급에서 중국 영향력 확대(오징어 등 가격 급등) 대응 - 시황 맞춘 선제적 재고 확보 전략', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', '지속', null),
  (45, '대표이사 지시사항', 45, '2026-05-08', '대표', '장기적으로 인도네시아 등 동남아 직접 저장·가공 방안 검토', '구매물류부', '구매물류부', '진행중', '진행중', '장기', null),
  (46, '부사장 지시사항', 1, '2026-03-06', '부사장', '상품·물류 실무인력 채용 예정대로 진행, 야간 관리자·외국인 실무인력 추가 채용 검토', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (47, '부사장 지시사항', 2, '2026-03-06', '부사장', '채용은 단순 충원 아닌 성과 확대+인력 재편 전제로 운영, 채용과 동시 평가·피드백 체계 구축', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (48, '부사장 지시사항', 3, '2026-03-06', '부사장', 'HACCP: 주니어 1명 채용+센터장 대행+외부 고문 활용 방향 검토, 세부 운영 추가 논의 후 확정', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (49, '부사장 지시사항', 4, '2026-03-06', '부사장', '영업 매니저 월 1명씩 보강, 파트장급은 적합 인원 확보 시까지 면접 지속', '기획영업부', '기획영업부', '지속', '지속', null, null),
  (50, '부사장 지시사항', 5, '2026-03-06', '부사장', '채권관리 핵심 목표: 약정일 100% 회수 설정, 채권팀·영업·경영지원 공동 프로세스 정비', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (51, '부사장 지시사항', 6, '2026-03-06', '부사장', '카드수수료 절감 위해 통장입금 등 현금성 수금 확대 방향 검토', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (52, '부사장 지시사항', 7, '2026-03-06', '부사장', '영업 단가·마진 운영 권한 기준·선조치·사후품의 기준 문서화', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (53, '부사장 지시사항', 8, '2026-03-06', '부사장', '카택스 3월 말까지 계도기간 운영, 이후 기준 미준수 시 지급 제외 등 통제 강화', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (54, '부사장 지시사항', 9, '2026-03-06', '부사장', '회의 내용 문서화 후 하이웍스 등 공식 기록으로 축적, 관리자 대상 기준 교육 강화', '전 부서', '전 부서', '지속', '지속', null, null),
  (55, '부사장 지시사항', 10, '2026-03-20', '부사장', '박하지 꽃게 악성재고 4월 중 단기 특판 방식 집중 소진 추진(4~5천원 특판)', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '완료', '완료', null, null),
  (56, '부사장 지시사항', 11, '2026-03-20', '부사장', '국산 고등어 재고 품질 재점검 후 별도 처리방안 수립(사료전환·선별·폐기 순차 검토)', '구매물류부', '구매물류부', '완료', '완료', null, null),
  (57, '부사장 지시사항', 12, '2026-03-20', '부사장', '영업 협조 유도: 회사 전략품목 판매 기여도·협조도를 평가 항목에 반영', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (58, '부사장 지시사항', 13, '2026-03-20', '부사장', '상품 운영 실패사례 백서 체계 마련(구매배경·판매경과·문제원인·결과·시사점 기록)', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (59, '부사장 지시사항', 14, '2026-03-20', '부사장', '향후 회의 시 악성재고·부진재고 진행현황 정례 보고 운영', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (60, '부사장 지시사항', 15, '2026-03-20', '부사장', '향후 악성재고 보고는 의사결정형 보고체계로 전환(손실규모·보완책·시장영향 포함)', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (61, '부사장 지시사항', 16, '2026-03-27', '부사장', '야간 운영: 당직자 중심 보완체계 우선 운영, 기획팀 로테이션 야간 당직 1명 배치', '기획영업부', '기획영업부', '완료', '완료', null, null),
  (62, '부사장 지시사항', 17, '2026-03-27', '부사장', '도크·출고시간 조정은 일부 대상부터 순차 검토(영업총괄 박정민 차장 협의)', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (63, '부사장 지시사항', 18, '2026-03-27', '부사장', '육가공·수산 신제품 입고 시 HACCP 통보 및 보고·서류 확보 절차 정비 후 전파', '구매물류부, HACCP', '구매물류부, 경영관리센터', '진행중', '진행중', null, null),
  (64, '부사장 지시사항', 19, '2026-03-27', '부사장', '해동 제품 해동중 표시·해동실 사용·온도유지 기준 재강조, 개봉 해동 금지 방향 계도', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (65, '부사장 지시사항', 20, '2026-03-27', '부사장', '부진재고 선공지 원칙 관리, 박하지 가격 확정 후 대표 보고, 단호박 원물 판매 중단 후 가공·외부처리 검토', '구매물류부', '구매물류부', '진행중', '진행중', null, null),
  (66, '부사장 지시사항', 21, '2026-03-27', '부사장', '청소인력 관련: 질서 위반 인원 TF 조사·징계위원회 회부 검토, 리더 중심 기본 태도 교육 즉시 강화', '전 부서', '전 부서', '완료', '완료', null, null),
  (67, '부사장 지시사항', 22, '2026-03-27', '부사장', '부서별 청소 임시 담당구역 지정 운영(월:경영지원센터, 화:기획영업부, 수:구매물류부)', '전 부서', '전 부서', '완료', '완료', null, null),
  (68, '부사장 지시사항', 23, '2026-04-03', '부사장', '주간회의 일반 현황공유보다 의사결정·이슈해결 중심으로 운영, 단순 공유사항은 사전 전달', '전 부서', '전 부서', '지속', '지속', null, null),
  (69, '부사장 지시사항', 24, '2026-04-03', '부사장', '4월 영업: 주차별 행사·물량 배분 중심 운영, 가격인상·비용상승 변수 반영 관리', '기획영업부', '기획영업부', '완료', '완료', null, null),
  (70, '부사장 지시사항', 25, '2026-04-03', '부사장', '수산물 해동 원칙적 금지 방향 관리, 거래처 D+2 선주문 체계 유도', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (71, '부사장 지시사항', 26, '2026-04-03', '부사장', '해동 요청 현행 카톡방식 유지, 업체명·상품명·대표자명 핵심정보 기재 강화 및 현장 표기 보완', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (72, '부사장 지시사항', 27, '2026-04-03', '부사장', '클레임 관리대장·이물 대응 기준 영업부 협의 후 매뉴얼 형태 정리(4단계 유형화)', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (73, '부사장 지시사항', 28, '2026-04-03', '부사장', '작업 닭다리 재고 내부 처리 한계 고려, 외주 활용 포함 실행방안 추진(4월 말까지 약 30톤)', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (74, '부사장 지시사항', 29, '2026-04-03', '부사장', '갈비탕용 등 추가 수요 품목 시세·작업여건 확인 후 리스트화 검토', '공장총괄본부', '공장총괄본부', '진행중', '진행중', null, null),
  (75, '부사장 지시사항', 30, '2026-04-03', '부사장', '시설 안전 문제 비교견적 및 즉시 공유체계 통해 조치속도 높임', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (76, '부사장 지시사항', 31, '2026-04-03', '부사장', '품질 개선 재고 품목(열빙어 등) 영업 관심품목으로 관리, 자연출고·추가판매 유도', '기획영업부', '기획영업부', '진행중', '진행중', null, null),
  (77, '부사장 지시사항', 32, '2026-04-03', '부사장', '랩비닐 등 부자재 추가 확보와 절약 운영 병행(홍보 캠페인·공문 작성 검토)', '전 부서', '전 부서', '완료', '완료', null, null),
  (78, '부사장 지시사항', 33, '2026-04-17', '부사장', '소방 편제 현장 체류인원 중심으로 구성, 대피반·소화반·비상연락망 다음 주까지 종합 정리', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (79, '부사장 지시사항', 34, '2026-04-17', '부사장', '소방 편제 확정 후 정기 교육·훈련 연계, 소방서 연계 합동훈련까지 순차 추진', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (80, '부사장 지시사항', 35, '2026-04-17', '부사장', '층별·팀별 필수 인원 편제와 비상연락처 취합 제출, 리더는 소화전 위치·비상조치 순서 숙지', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (81, '부사장 지시사항', 36, '2026-04-17', '부사장', '소화기 정기 점검 기준 마련 검토, 무게·상태 주기적 확인 체계 구축', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (82, '부사장 지시사항', 37, '2026-04-17', '부사장', '감지기·전기설비 교체·보강 추진, 관련 견적 계속 검토', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (83, '부사장 지시사항', 38, '2026-04-17', '부사장', '근생동·공장동 시설 위험요소 재점검 및 보강 우선순위 정리', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (84, '부사장 지시사항', 39, '2026-04-17', '부사장', '관리자 대상 화재 초기대응 교육 실제 행동 위주로 반복 실시', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (85, '부사장 지시사항', 40, '2026-04-17', '부사장', '저수조 청소 전 물 활용(청소·방수 연습 등) 계획 일정에 맞춰 사전 공유', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (86, '부사장 지시사항', 41, '2026-04-17', '부사장', '도크 운영시간 전면 후행 이동 대신 병목 분산 중심으로 검토, 기사·영업·물류 실무 반영 별도 협의', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (87, '부사장 지시사항', 42, '2026-04-17', '부사장', '주문 마감 1차/2차 발주 분리 방안 기획영업팀 실현가능성 먼저 검토, 1~2개 파트 시험 적용 여부 판단(월요일 10시 추가 논의)', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (88, '부사장 지시사항', 43, '2026-04-17', '부사장', '경고 3회 이후 운영기준 취지 유지, 사면성 리셋 또는 상벌 연계형 보완방안 별도 지침 받아 검토', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (89, '부사장 지시사항', 44, '2026-04-17', '부사장', '리더 공식석상 감정 배설성 발언 지양, 배려·명확성 중심 표현 기준 준수 재강조', '전 부서', '전 부서', '지속', '지속', null, null),
  (90, '부사장 지시사항', 45, '2026-04-24', '부사장', '직장소방대 편성 보완: 소방서 컨설팅 후 편성안 보완, 자체 초동조치 훈련 후 합동훈련으로 연계', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (91, '부사장 지시사항', 46, '2026-04-24', '부사장', '소방훈련 시간은 인식당 운영 고려 오후 4시 30분 전후로 준비', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (92, '부사장 지시사항', 47, '2026-04-24', '부사장', '소화기 전수 확인 후 라벨 부착, 매월 5일 정기점검 체계로 운영(층별 위치·수량 확인 포함)', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (93, '부사장 지시사항', 48, '2026-04-24', '부사장', '인식당 주방 화재 대응: 일반 소화기 외 주방 특수 화재 대응체계 별도 정비(본부장 협의)', '경영관리센터, 구매물류부', '경영관리센터, 구매물류부', '진행중', '진행중', null, null),
  (94, '부사장 지시사항', 49, '2026-04-24', '부사장', '부진 재고·유통기한 이슈 카톡 등 간단한 방식으로 품목명·수량·유통기한 즉시 선공유(수산·육가공)', '구매물류부', '구매물류부', '진행중', '진행중', null, null),
  (95, '부사장 지시사항', 50, '2026-04-24', '부사장', '스펙 변경 시 공지로 명확히 공유, 품목 등록은 가능하면 신규 등록 방식으로 전환(고객 히스토리 관리)', '구매물류부, 기획영업부', '구매물류부, 기획영업부', '진행중', '진행중', null, null),
  (96, '부사장 지시사항', 51, '2026-04-24', '부사장', '해동·예냉 기준 재정리: 품목·요청자·요청사유 기재 방식으로 법 위반 없이 영업 실무 적용 기준 재배포', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (97, '부사장 지시사항', 52, '2026-04-24', '부사장', '도크 테스트 준비된 파트부터 제한적 시행, 7파트 준비 시 영업사원 포함 일부 라인 시험 적용', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (98, '부사장 지시사항', 53, '2026-04-24', '부사장', '도크 테스트 대상 파트·조기 출근 인원 편성 사전 확정, 실제 물량 변동에 따른 운영 부담 점검', '기획영업부, 구매물류부', '기획영업부, 구매물류부', '진행중', '진행중', null, null),
  (99, '부사장 지시사항', 54, '2026-04-24', '부사장', '인식당 앞 이동식 도크 설치 추진(합법성 검토 완료), 설치 위치·동선·안전성·운영효율 검토', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (100, '부사장 지시사항', 55, '2026-04-24', '부사장', '각 부서 상반기·하반기 인력 계획 사전 정리, 인력 부족 사후 대응 아닌 사전 공유 원칙', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (101, '부사장 지시사항', 56, '2026-04-24', '부사장', '물류 야간 2명 추가 충원, 생산 포장실 보조 1명 채용 검토(근무형태·선호 스펙 구체화)', '경영관리센터, 구매물류부', '경영관리센터, 구매물류부', '진행중', '진행중', null, null),
  (102, '부사장 지시사항', 57, '2026-04-24', '부사장', '공장 청소 전담인력 채용: 청소 구역·업무범위 월·화까지 공장 측 정리 후 채용방식 결정', '경영관리센터', '경영관리센터', '완료', '완료', null, null),
  (103, '부사장 지시사항', 58, '2026-04-24', '부사장', '음주·흡연·기숙사 화기사용 등 생활안전 기준 각 부서 즉시 재교육, 안전점검의 날(매월 5일) 연계 점검·통제', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (104, '부사장 지시사항', 59, '2026-04-24', '부사장', '화장실 사용제한 필요 시 잠금·테이핑·외국어 안내문 부착까지 시행', '경영관리센터', '경영관리센터', '진행중', '진행중', null, null),
  (105, '부사장 지시사항', 60, '2026-04-24', '부사장', '주간회의 지시사항 DB 기반 전환: 완료·진행·논의 필요 항목 구분, 회의시간 단축 운영', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (106, '부사장 지시사항', 61, '2026-04-24', '부사장', '대표님과 개별 논의된 사항도 관련 부서에 반드시 공유(리더방 등 활용)', '전 부서', '전 부서', '진행중', '진행중', null, null),
  (107, '부사장 지시사항', 62, '2026-04-24', '부사장', '육가공 3번 냉동창고 내부 추가 활용: 구매물류부 협의 후 세부 내용 검토·공유', '구매물류부', '구매물류부', '진행중', '진행중', null, null),
  (108, '부사장 지시사항', 63, '2026-04-24', '부사장', '기획영업부 사무실 냉동창고 공사: 공간 재배치·대체 사무공간·공사비·효율 검토 후 결재문 구체화', '기획영업부, 경영관리센터', '기획영업부, 경영관리센터', '진행중', '진행중', null, null),
  (109, '부사장 지시사항', 64, '2026-05-08', '부사장', '4월 평가 2차 연습 준비 및 다면평가 항목 사전 공유(구글폼 활용, 10개 내외)', '전 부서', '전 부서', '진행중', '진행중', '5/15', '2026-05-15'),
  (110, '부사장 지시사항', 65, '2026-05-08', '부사장', '다면평가 외부 인원 통해 시행(데이터 유출 방지) - 18일 전후 예정', '전 부서', '전 부서', '진행중', '진행중', '5/18', '2026-05-18'),
  (111, '부사장 지시사항', 66, '2026-05-08', '부사장', '주차별 매출 프로모션 고도화 별도 논의(기획영업부장 협의)', '기획영업부', '기획영업부', '진행중', '진행중', '5월 중', null),
  (112, '부사장 지시사항', 67, '2026-05-08', '부사장', '직원 주차 외부 공간 재협상(60만원→30만원대) 및 마산초등학교 인근·정류장 인근 밭 등 추가 공간 탐색', '경영관리센터', '경영관리센터', '진행중', '진행중', '금주', null),
  (113, '부사장 지시사항', 68, '2026-05-08', '부사장', '사내 주차 효율화 - 화물차 안쪽 배치 및 직원 차량 키 위탁·대리 이동 방식 검토', '경영관리센터', '경영관리센터', '진행중', '진행중', '금주', null),
  (114, '부사장 지시사항', 69, '2026-05-08', '부사장', '전 부서 층별 소화기 위치·수량 데이터 종합 제출(현재 육가공만 제출)', '각 부서장', '각 부서장', '진행중', '진행중', '금주', null),
  (115, '부사장 지시사항', 70, '2026-05-08', '부사장', '자체 소방 초동조치 훈련 후 관내 소방서 합동훈련 진행', '경영관리센터', '경영관리센터', '진행중', '진행중', '5월 중', null),
  (116, '부사장 지시사항', 71, '2026-05-08', '부사장', '차량사고 책임기준 각 부서 의견 취합 후 최종 확정 공지(사적사용 100%/업무중 0%/법규위반 50%)', '전 부서', '전 부서', '진행중', '진행중', '차주', null),
  (117, '부사장 지시사항', 72, '2026-05-08', '부사장', '육가공 발주 취합 개선 - 워크메이트 프로그램 시범 적용 검토', '구매물류부', '구매물류부', '진행중', '진행중', '차주', null),
  (118, '부사장 지시사항', 73, '2026-05-08', '부사장', '야식 임시 운영(9~9:30 반찬 교체·메인 재가열, 시간당 2만원 자원자, 9시 이후 잔식 전량 폐기)', '기획영업부', '기획영업부', '진행중', '진행중', '즉시', null),
  (119, '부사장 지시사항', 74, '2026-05-08', '부사장', '야식 담당 인력 채용 완료 시 정식 야식 운영 체계 전환', '경영관리센터', '경영관리센터', '진행중', '진행중', '채용 후', null),
  (120, '부사장 지시사항', 75, '2026-05-08', '부사장', '일요일 생산팀 식사 - 햇반·간단 조리 자율 방식 유지(별도 취사 인력 미편성)', '전 부서', '전 부서', '진행중', '진행중', '지속', null),
  (121, '부사장 지시사항', 76, '2026-05-08', '부사장', '청소 전담 인력 추가 채용 없음 - 각 부서 자기 영역 자체 청소 철저 시행, 미화 인력은 공용 외부 공간 운영', '각 부서장', '각 부서장', '완료', '완료', '즉시', null),
  (122, '부사장 지시사항', 77, '2026-05-08', '부사장', '청소 인력 미운영 결론 대표이사 보고', '경영관리센터', '경영관리센터', '진행중', '진행중', '금주', null),
  (123, '부사장 지시사항', 78, '2026-05-08', '부사장', '산업안전 지원금 항목 리스트 시설TF 공유 → 센터장 총괄 청구 추진(지게차 안전바·적재 안전기구 등 소급 청구 가능 여부 확인)', '전 부서', '전 부서', '진행중', '진행중', '차주', null),
  (124, '부사장 지시사항', 79, '2026-05-08', '부사장', '야간 안전관리자 등록 추진 - 야간 물류 근무 중인 안전 전문성 보유 인력 활용', '경영관리센터', '경영관리센터', '진행중', '진행중', '5/12', '2026-05-12'),
  (125, '부사장 지시사항', 80, '2026-05-08', '부사장', '월간 안전 회의(최고경영자 포함) 데이터 정리 후 별도 보고', '경영관리센터', '경영관리센터', '진행중', '진행중', '5월 중', null),
  (126, '부사장 지시사항', 81, '2026-05-08', '부사장', '3·4월 평가 중요성(7월 성과급 직결) 팀원 공유 및 다면평가 취지 재교육 - 인기투표 아닌 리더십·동기부여·자발적 참여 측정', '각 리더', '각 리더', '진행중', '진행중', '금주', null),
  (127, '부사장 지시사항', 82, '2026-05-08', '부사장', '리더십 운영 원칙 - 업무적 질책·코칭은 강하게, 인간적 관계는 따뜻하게 분리 운영', '각 리더', '각 리더', '지속', '지속', '지속', null);

create temp table tmp_cn_directive_260508_settings (
  import_year int not null,
  import_batch text not null,
  archive_reason text not null
) on commit preserve rows;

insert into tmp_cn_directive_260508_settings (
  import_year,
  import_batch,
  archive_reason
) values (
  2026,
  'CN_260508_DIRECTIVE_REPLACE_127',
  'CN 260508 directive replace archive'
);

create temp table tmp_cn_directive_260508_department_map (
  report_name text primary key,
  canonical_name text not null
) on commit preserve rows;

insert into tmp_cn_directive_260508_department_map (
  report_name,
  canonical_name
) values
  ('전 부서', '전체'),
  ('전체', '전체'),
  ('기획영업부', '영업본부'),
  ('영업본부', '영업본부'),
  ('경영관리센터', '경영관리센터'),
  ('HACCP', '경영관리센터'),
  ('구매물류부', '구매물류부'),
  ('각 부서장', '전체'),
  ('각 리더', '전체'),
  ('공장총괄본부', '공장총괄본부');

create temp table tmp_cn_directive_260508_expected_departments (
  department_name text primary key,
  total_count int not null,
  in_progress_count int not null,
  completed_count int not null,
  continuing_count int not null,
  completion_rate int not null
) on commit preserve rows;

insert into tmp_cn_directive_260508_expected_departments (
  department_name,
  total_count,
  in_progress_count,
  completed_count,
  continuing_count,
  completion_rate
) values
  ('전 부서', 37, 29, 5, 3, 22),
  ('기획영업부', 36, 29, 4, 3, 19),
  ('경영관리센터', 38, 30, 8, 0, 21),
  ('구매물류부', 28, 23, 4, 1, 18),
  ('각 부서장', 2, 1, 1, 0, 50),
  ('각 리더', 2, 1, 0, 1, 50),
  ('공장총괄본부', 1, 1, 0, 0, 0);

create temp table tmp_cn_directive_260508_prepared on commit preserve rows as
with normalized as (
  select
    t.source_order,
    t.source_sheet,
    t.source_no,
    t.meeting_date,
    t.chair_role,
    t.directive_text,
    t.departments_raw,
    t.report_departments,
    t.status_ko,
    t.report_bucket,
    nullif(btrim(t.note), '') as note,
    t.due_date,
    extract(month from t.meeting_date)::int as meeting_month,
    extract(day from t.meeting_date)::int as meeting_day,
    row_number() over (
      partition by date_trunc('month', t.meeting_date)
      order by t.source_order
    ) as month_seq,
    case t.status_ko
      when '진행중' then 'IN_PROGRESS'
      when '지속' then 'IN_PROGRESS'
      when '완료' then 'COMPLETED'
      else null
    end as status_en,
    case t.report_bucket
      when '진행중' then '진행중'
      when '지속' then '지속'
      when '완료' then '완료'
      else null
    end as report_bucket_normalized
  from tmp_cn_directive_260508_import t
)
select
  n.source_order,
  n.source_sheet,
  n.source_no,
  n.meeting_date,
  n.chair_role,
  n.directive_text,
  n.departments_raw,
  n.report_departments,
  n.status_ko,
  n.report_bucket_normalized as report_bucket,
  n.note,
  n.due_date,
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
  'SELECTED'::text as target_scope,
  n.status_en
from normalized n
cross join tmp_cn_directive_260508_settings s;

create temp table tmp_cn_directive_260508_target_departments on commit preserve rows as
with active_departments as (
  select
    d.id,
    d.name,
    d.head_user_id
  from public.departments d
  where d.is_active = true
),
selected_targets as (
  select
    p.source_order,
    p.directive_no,
    p.status_en,
    p.directive_created_at as assigned_at,
    p.due_date,
    dep.ordinality::int as target_order,
    d.id as department_id,
    d.name as department_name,
    d.head_user_id as department_head_id
  from tmp_cn_directive_260508_prepared p
  join lateral regexp_split_to_table(p.report_departments, '\s*,\s*') with ordinality as dep(report_name, ordinality)
    on true
  join tmp_cn_directive_260508_department_map m
    on m.report_name = trim(dep.report_name)
  join active_departments d
    on d.name = m.canonical_name
),
deduped as (
  select distinct on (s.directive_no, s.department_id)
    s.source_order,
    s.directive_no,
    s.department_id,
    s.department_name,
    s.department_head_id,
    s.status_en,
    s.assigned_at,
    s.due_date,
    s.target_order
  from selected_targets s
  order by s.directive_no, s.department_id, s.target_order
),
ranked as (
  select
    d.*,
    min(d.target_order) over (partition by d.directive_no) as primary_target_order
  from deduped d
)
select
  r.source_order,
  r.directive_no,
  r.department_id,
  r.department_name,
  r.department_head_id,
  r.status_en,
  r.assigned_at,
  r.due_date,
  r.target_order,
  (r.target_order = r.primary_target_order) as is_primary,
  case
    when r.target_order = r.primary_target_order then 'OWNER'
    else 'SUPPORT'
  end as assignment_role
from ranked r;

create temp table tmp_cn_directive_260508_resolved on commit preserve rows as
with mapped_names as (
  select
    t.directive_no,
    string_agg(t.department_name, ', ' order by t.target_order, t.department_name) as mapped_department_names
  from tmp_cn_directive_260508_target_departments t
  group by t.directive_no
)
select
  p.source_order,
  p.source_sheet,
  p.source_no,
  p.meeting_date,
  p.chair_role,
  p.directive_text,
  p.departments_raw,
  p.report_departments,
  p.status_ko,
  p.report_bucket,
  p.note,
  p.due_date,
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
  m.mapped_department_names
from tmp_cn_directive_260508_prepared p
left join tmp_cn_directive_260508_target_departments o
  on o.directive_no = p.directive_no
 and o.is_primary = true
left join mapped_names m
  on m.directive_no = p.directive_no;

  select
    s.import_year,
    s.import_batch,
    s.archive_reason
  into
    v_import_year,
    v_import_batch,
    v_archive_reason
  from tmp_cn_directive_260508_settings s;

  v_archive_suffix := to_char(v_archived_at at time zone 'Asia/Seoul', 'YYYYMMDDHH24MISS');

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
    raise exception 'CN 260508 import blocked: active CEO/SUPER_ADMIN account not found for created_by.';
  end if;

  if exists (select 1 from tmp_cn_directive_260508_prepared where status_en is null) then
    raise exception 'CN 260508 import blocked: unsupported internal status found.';
  end if;

  if exists (select 1 from tmp_cn_directive_260508_prepared where report_bucket is null) then
    raise exception 'CN 260508 import blocked: unsupported report bucket found.';
  end if;

  if exists (
    select 1
    from tmp_cn_directive_260508_prepared
    where status_en in ('CONTINUING', 'ONGOING', 'SUSTAINED', '지속')
  ) then
    raise exception 'CN 260508 import blocked: report bucket leaked into workflow status.';
  end if;

  if exists (
    select 1
    from (
      select trim(dep.report_name) as report_name
      from tmp_cn_directive_260508_prepared p
      join lateral regexp_split_to_table(p.report_departments, '\s*,\s*') as dep(report_name)
        on true
    ) x
    left join tmp_cn_directive_260508_department_map m
      on m.report_name = x.report_name
    where m.report_name is null
  ) then
    raise exception 'CN 260508 import blocked: unmapped report department label found.';
  end if;

  if exists (
    select 1
    from tmp_cn_directive_260508_department_map m
    left join public.departments d
      on d.name = m.canonical_name
     and d.is_active = true
    where d.id is null
  ) then
    raise exception 'CN 260508 import blocked: mapped canonical department is not active.';
  end if;

  select count(*)
  into v_planned_directive_count
  from tmp_cn_directive_260508_resolved;

  if v_planned_directive_count <> 127 then
    raise exception 'CN 260508 import blocked: expected 127 directives, prepared % directives.', v_planned_directive_count;
  end if;

  if not exists (
    select 1
    from tmp_cn_directive_260508_prepared
    where source_sheet = '부사장 지시사항'
      and source_no = 63
      and meeting_date = date '2026-04-24'
      and directive_text = '기획영업부 사무실 냉동창고 공사: 공간 재배치·대체 사무공간·공사비·효율 검토 후 결재문 구체화'
  ) then
    raise exception 'CN 260508 import blocked: missing VP No.63 cold-storage directive.';
  end if;

  if (
    select count(*) from tmp_cn_directive_260508_target_departments
  ) <> v_expected_assignment_count then
    raise exception
      'CN 260508 import blocked: expected % directive_departments rows, prepared % rows.',
      v_expected_assignment_count,
      (select count(*) from tmp_cn_directive_260508_target_departments);
  end if;

  if exists (
    select 1
    from tmp_cn_directive_260508_target_departments t
    group by t.directive_no
    having count(*) filter (where t.is_primary) <> 1
  ) then
    raise exception 'CN 260508 import blocked: each directive must have exactly one primary department.';
  end if;

  if exists (
    select 1
    from tmp_cn_directive_260508_target_departments t
    join tmp_cn_directive_260508_prepared p
      on p.directive_no = t.directive_no
    where p.report_departments = '전 부서'
    group by t.directive_no
    having count(*) <> 1
  ) then
    raise exception 'CN 260508 import blocked: all-department report group must remain a single assignment group.';
  end if;

  if exists (
    select 1
    from (
      select
        p.report_bucket,
        count(*) as total_count
      from tmp_cn_directive_260508_prepared p
      group by p.report_bucket
    ) actual
    where (actual.report_bucket = '진행중' and actual.total_count <> 99)
       or (actual.report_bucket = '완료' and actual.total_count <> 20)
       or (actual.report_bucket = '지속' and actual.total_count <> 8)
  ) then
    raise exception 'CN 260508 import blocked: total report bucket counts do not match 99/20/8.';
  end if;

  if exists (
    with actual as (
      select
        case when p.chair_role = '부사장' then '부사장' else '대표' end as chair_role,
        count(*) as total_count,
        count(*) filter (where p.report_bucket = '진행중') as in_progress_count,
        count(*) filter (where p.report_bucket = '완료') as completed_count,
        count(*) filter (where p.report_bucket = '지속') as continuing_count
      from tmp_cn_directive_260508_prepared p
      group by case when p.chair_role = '부사장' then '부사장' else '대표' end
    ), expected as (
      select * from (
        values
          ('대표'::text, 45, 35, 7, 3),
          ('부사장'::text, 82, 64, 13, 5)
      ) as e(chair_role, total_count, in_progress_count, completed_count, continuing_count)
    )
    select 1
    from expected e
    left join actual a on a.chair_role = e.chair_role
    where coalesce(a.total_count, -1) <> e.total_count
       or coalesce(a.in_progress_count, -1) <> e.in_progress_count
       or coalesce(a.completed_count, -1) <> e.completed_count
       or coalesce(a.continuing_count, -1) <> e.continuing_count
  ) then
    raise exception 'CN 260508 import blocked: chair summary counts do not match.';
  end if;

  if exists (
    with report_departments as (
      select
        trim(dep.report_name) as department_name,
        p.report_bucket
      from tmp_cn_directive_260508_prepared p
      join lateral regexp_split_to_table(p.report_departments, '\s*,\s*') as dep(report_name)
        on true
    ), actual as (
      select
        d.department_name,
        count(*)::int as total_count,
        count(*) filter (where d.report_bucket = '진행중')::int as in_progress_count,
        count(*) filter (where d.report_bucket = '완료')::int as completed_count,
        count(*) filter (where d.report_bucket = '지속')::int as continuing_count,
        round(
          (
            count(*) filter (where d.report_bucket in ('완료', '지속'))::numeric
            / nullif(count(*), 0)
          ) * 100
        )::int as completion_rate
      from report_departments d
      group by d.department_name
    )
    select 1
    from tmp_cn_directive_260508_expected_departments e
    left join actual a on a.department_name = e.department_name
    where coalesce(a.total_count, -1) <> e.total_count
       or coalesce(a.in_progress_count, -1) <> e.in_progress_count
       or coalesce(a.completed_count, -1) <> e.completed_count
       or coalesce(a.continuing_count, -1) <> e.continuing_count
       or coalesce(a.completion_rate, -1) <> e.completion_rate
  ) then
    raise exception 'CN 260508 import blocked: department summary counts do not match.';
  end if;

  update public.directives d
  set
    archive_reason = v_archive_reason,
    archived_at = v_archived_at,
    archived_by = v_import_user_id,
    directive_no = 'OLD-' || d.directive_no || '-' || v_archive_suffix || '-' || left(d.id::text, 8),
    is_archived = true
  where d.is_archived = false
    and d.content not like '%' || v_import_batch || '%';

  get diagnostics v_archived_directive_count = row_count;

  update public.directives d
  set
    archive_reason = coalesce(d.archive_reason, v_archive_reason),
    archived_at = coalesce(d.archived_at, v_archived_at),
    archived_by = coalesce(d.archived_by, v_import_user_id),
    directive_no = 'OLD-' || d.directive_no || '-' || v_archive_suffix || '-' || left(d.id::text, 8),
    is_archived = true
  where d.directive_no in (select r.directive_no from tmp_cn_directive_260508_resolved r)
    and d.content not like '%' || v_import_batch || '%';

  update public.directives d
  set sequence = archived_directives.new_sequence
  from (
    with month_sequence_floors as (
      select
        year_month,
        least(coalesce(min(sequence), -100000), -100000) as sequence_floor
      from public.directives
      group by year_month
    )
    select
      archived.id,
      month_sequence_floors.sequence_floor
        - row_number() over (
            partition by archived.year_month
            order by archived.archived_at nulls last, archived.created_at, archived.id
          ) as new_sequence
    from public.directives archived
    join month_sequence_floors
      on month_sequence_floors.year_month is not distinct from archived.year_month
    where archived.is_archived = true
  ) archived_directives
  where d.id = archived_directives.id;

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
    archive_reason,
    archived_at,
    archived_by,
    target_scope
  )
  select
    gen_random_uuid(),
    r.directive_no,
    r.year_month,
    r.month_seq,
    r.directive_text,
    r.directive_text
      || E'

[원본이관정보]'
      || E'
- 이관배치: ' || r.import_batch
      || E'
- 원본시트: ' || r.source_sheet
      || E'
- 원본번호: ' || r.source_no::text
      || E'
- 원본회의일: ' || to_char(r.meeting_date, 'YYYY-MM-DD')
      || E'
- 적용연도: ' || r.import_year::text
      || E'
- 주관: ' || r.chair_role
      || E'
- 원본상태: ' || r.status_ko
      || E'
- 보고상태: ' || r.report_bucket
      || E'
- 원본담당부서: ' || r.departments_raw
      || E'
- 보고담당부서: ' || r.report_departments
      || E'
- 이관주관부서: ' || r.owner_department_name
      || E'
- 이관담당부서: ' || coalesce(r.mapped_department_names, '')
      || E'
- source_type(보존): MEETING'
      || E'
- priority(보존): MEDIUM'
      || coalesce(E'
- 기한/비고: ' || r.note, ''),
    r.status_en,
    false,
    null,
    r.due_date,
    v_import_user_id,
    r.created_at,
    r.owner_department_id,
    null,
    false,
    null,
    null,
    null,
    r.target_scope
  from tmp_cn_directive_260508_resolved r
  on conflict (directive_no) do update
  set
    title = excluded.title,
    content = excluded.content,
    year_month = excluded.year_month,
    sequence = excluded.sequence,
    status = excluded.status,
    due_date = excluded.due_date,
    owner_department_id = excluded.owner_department_id,
    is_archived = false,
    archive_reason = null,
    archived_at = null,
    archived_by = null,
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
    t.due_date,
    case when t.status_en = 'COMPLETED' then v_archived_at else null end,
    t.assigned_at,
    v_archived_at,
    t.is_primary,
    t.assignment_role
  from tmp_cn_directive_260508_target_departments t
  join public.directives d
    on d.directive_no = t.directive_no
  on conflict (directive_id, department_id) do update
  set
    department_head_id = excluded.department_head_id,
    department_status = excluded.department_status,
    department_due_date = excluded.department_due_date,
    department_closed_at = excluded.department_closed_at,
    is_primary = excluded.is_primary,
    assignment_role = excluded.assignment_role,
    updated_at = excluded.updated_at;

  raise notice 'CN 260508 import ready: year=% batch=% rows=127 archived=% created_by=% (%).',
    v_import_year,
    v_import_batch,
    v_archived_directive_count,
    v_import_user_id,
    v_import_user_email;

drop table if exists
  tmp_cn_directive_260508_resolved,
  tmp_cn_directive_260508_target_departments,
  tmp_cn_directive_260508_prepared,
  tmp_cn_directive_260508_expected_departments,
  tmp_cn_directive_260508_department_map,
  tmp_cn_directive_260508_settings,
  tmp_cn_directive_260508_import;

end $$;
