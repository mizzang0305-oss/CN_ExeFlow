# API 계약 초안

## Directives
### POST /api/directives
- 지시사항 생성

### GET /api/directives
- 목록 조회
- query: status, departmentId, priority, search, page, pageSize

### GET /api/directives/:id
- 상세 조회

### PATCH /api/directives/:id
- 기본 정보 수정

### POST /api/directives/:id/assign-department
- 부서 배정

### POST /api/directives/:id/request-completion
- 완료 요청

### POST /api/directives/:id/approve-completion
- 종결 승인

### POST /api/directives/:id/reject-completion
- 완료 반려

## Tasks
### POST /api/directives/:id/tasks
- 세부 과업 생성

### PATCH /api/tasks/:id
- 과업 수정 / 상태 변경

## Logs
### POST /api/directives/:id/logs
- 행동 로그 등록

### GET /api/directives/:id/logs
- 로그 목록 조회

## Attachments
### POST /api/directives/:id/attachments
- 증빙 첨부 업로드

### GET /api/directives/:id/attachments
- 첨부 목록 조회

## Reports
### POST /api/reports/weekly/generate
- 주간 결산 생성

### GET /api/reports/weekly
- 주간 결산 목록

### GET /api/reports/weekly/:id
- 주간 결산 상세

## Dashboard
### GET /api/dashboard/ceo
- 대표 대시보드 요약 데이터

### GET /api/dashboard/department/:departmentId
- 부서 대시보드 요약 데이터
