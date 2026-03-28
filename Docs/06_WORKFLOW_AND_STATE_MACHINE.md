# 워크플로우 및 상태 머신

## 1. 기본 플로우
1. 대표 또는 회의 결과로 지시 발생
2. TF 총괄이 지시사항 등록
3. 관리번호 자동 발급
4. 소관 부서 및 책임자 지정
5. 부서장이 담당자/세부 과업 지정
6. 담당자가 행동 로그 및 증빙 등록
7. 부서장이 완료 요청
8. TF 총괄이 승인 또는 반려
9. 승인 시 종결
10. 시스템이 주간 결산 생성

## 2. 상태 정의
- NEW
- IN_PROGRESS
- COMPLETION_REQUESTED
- DELAYED
- COMPLETED
- REJECTED

## 3. 상태 설명
### NEW
등록만 되었고 실행이 시작되지 않은 상태

### IN_PROGRESS
부서/담당자가 실행 중인 상태

### COMPLETION_REQUESTED
부서에서 완료를 주장하며 승인 대기 중인 상태

### DELAYED
예정일이 경과했으나 아직 종결되지 않은 상태

### COMPLETED
승인 완료된 최종 종결 상태

### REJECTED
완료 요청이 반려되어 보완이 필요한 상태

## 4. 상태 전환 규칙
- NEW -> IN_PROGRESS
  - 부서 배정 또는 담당자 지정 완료
- IN_PROGRESS -> COMPLETION_REQUESTED
  - 부서장이 완료 요청 수행
- IN_PROGRESS -> DELAYED
  - due_date 경과 && COMPLETED 아님
- DELAYED -> IN_PROGRESS
  - 일정 재조정 및 재실행
- COMPLETION_REQUESTED -> COMPLETED
  - TF 승인
- COMPLETION_REQUESTED -> REJECTED
  - TF 반려
- REJECTED -> IN_PROGRESS
  - 보완 후 재진행

## 5. 종결 승인 기준
모두 충족해야 함
- 실행 완료
- 핵심 증빙 첨부 완료
- 결과 요약 입력 완료
- 승인자 확인 완료

## 6. 지연 판정 기준
- 기준일 = due_date
- 조건 = 현재시간 > due_date AND status != COMPLETED
- 예외 = 별도 승인된 연장 상태가 있는 경우 재계산

## 7. 로그 타입 제안
- VISIT
- CALL
- MEETING
- DOCUMENT_SUBMITTED
- ISSUE_FOUND
- ISSUE_RESOLVED
- PHOTO_UPLOADED
- STATUS_NOTE
