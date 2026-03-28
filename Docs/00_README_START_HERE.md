# DirectiveOps 설계 잠금 패키지 v1

이 폴더는 대표 지시사항 전사 총괄 및 부서별 이행관리 시스템의
설계 기준, 화면 기준, 데이터 기준, 상태 기준, 권한 기준, KPI 기준을
잠그기 위한 소스 패키지입니다.

## 목적
- 프로젝트 방향을 흔들리지 않게 고정
- GPT / Gemini / Codex / 개발자에게 동일한 기준 제공
- 기능 추가 전, 핵심 범위와 예외를 먼저 잠금
- DB / API / 화면 / 권한 / 상태값의 기준 문서화

## 사용 순서
1. 01_PROJECT_GUIDELINE.md
2. 02_PRODUCT_PRD.md
3. 03_SCOPE_LOCK.md
4. 04_INFORMATION_ARCHITECTURE.md
5. 05_USER_ROLES_AND_PERMISSIONS.md
6. 06_WORKFLOW_AND_STATE_MACHINE.md
7. 07_SCREEN_DEFINITIONS.md
8. 08_DB_SCHEMA_LOCK.md
9. 09_REPORTING_AND_KPI.md
10. 10_BUSINESS_RULES_LOCK.md
11. 11_API_CONTRACT_DRAFT.md
12. 12_STITCH_UI_ULTRA_PROMPT.txt
13. 13_GEMINI_ULTRA_PROMPT.txt
14. 14_ACCEPTANCE_CHECKLIST.md

## 설계 잠금 원칙
- 본 시스템의 본질은 ‘보고 앱’이 아니라 ‘대표 지시 실행 통제 시스템’이다.
- 대표 지시 → 부서 이행 → 행동 로그 → 증빙 → 종결 승인 → 주간 결산 흐름은 변경 불가 핵심 축이다.
- MVP에서는 핵심 운영에 직접 기여하지 않는 기능을 배제한다.
- 종결, 지연, 반려 기준은 문서 기준과 DB 기준이 일치해야 한다.
