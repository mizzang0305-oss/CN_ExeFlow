# CN EXEFLOW

CN EXEFLOW는 대표 지시를 기준으로 실행, 증빙, 승인, 결산을 통제하는 조직 실행 통제 시스템입니다.

## 기술 스택

- Next.js App Router
- TypeScript
- Supabase Database / Auth / Storage

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경 변수

`.env.example`을 `.env.local`로 복사한 뒤 아래 값을 설정합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 필수 마이그레이션

아래 순서대로 Supabase SQL Editor 또는 마이그레이션 파이프라인에 반영합니다.

1. `supabase/migrations/202603290001_directives_history_soft_delete.sql`
2. `supabase/migrations/202603290002_multi_department_directive_assignments.sql`
3. `supabase/migrations/202603290003_auth_activity_notifications.sql`

## 인증 구조

- 인증은 Supabase Auth를 사용합니다.
- 조직 기준 사용자 정보는 `public.users`가 유지합니다.
- `public.users.auth_user_id`가 Auth 계정과 조직 사용자를 연결합니다.
- 로그인 세션은 기존 앱 흐름을 깨지 않도록 앱 쿠키 기반으로 유지합니다.

### 최초 사용자 활성화

1. 이메일 입력
2. `public.users`에서 사용자 확인
3. 이름, 부서, 직책, 역할 확인
4. 비밀번호 설정
5. Supabase Auth 계정 생성 및 `auth_user_id` 연결
6. 즉시 로그인

### 이후 로그인

- 이메일 + 비밀번호 로그인
- 로그인 상태 유지 지원
- 비밀번호 재설정 링크 지원

## 구현된 운영 로그

### 접속 로그

- 테이블: `public.auth_activity_logs`
- 이벤트: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `SESSION_EXPIRED`

### 사용자 활동 로그

- 테이블: `public.user_activity_logs`
- 기록 대상:
  - 대시보드 진입
  - 지시사항 목록 조회
  - 지시 상세 조회
  - 완료 요청 클릭
  - 승인 클릭
  - 반려 클릭
  - 승인 대기 큐 조회
  - 로그 등록
  - 첨부 업로드

### 디바이스 및 알림 로그

- 디바이스 테이블: `public.user_devices`
- 알림 로그 테이블: `public.notification_logs`
- 로그인 후 디바이스 등록, 최종 접속 시간 갱신, 브라우저 알림 권한 요청

## 관리자/운영 화면

- `/admin/auth-logs`
- `/admin/activity-logs`
- `/admin/notification-logs`

권한 범위는 역할별로 자동 제한됩니다.

- `CEO`, `SUPER_ADMIN`: 전체 조회
- `DEPARTMENT_HEAD`: 자기 부서 범위 조회
- `STAFF`: 본인 기록 조회
- `VIEWER`: 제한적 조회

## 푸시 디스패치 구조

- `notification_logs`에 알림 큐를 적재합니다.
- `supabase/functions/push-dispatch/index.ts` Edge Function이 디바이스와 알림 로그를 읽어 푸시 공급자 웹훅으로 전달합니다.
- 공급자 웹훅은 `PUSH_PROVIDER_WEBHOOK_URL`과 `PUSH_PROVIDER_WEBHOOK_SECRET`으로 연결합니다.
- 웹훅이 없거나 디바이스가 없으면 `delivery_status`를 `FAILED`로 남겨 감사 추적이 가능하도록 처리합니다.

### Edge Function 예시 호출

```bash
supabase functions serve push-dispatch
```

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/push-dispatch \
  -H "Content-Type: application/json" \
  -d "{\"notificationLogId\":\"<알림로그ID>\"}"
```

## 현재 포함된 주요 API

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/lookup-user`
- `POST /api/auth/activate`
- `POST /api/auth/reset-password`
- `POST /api/activity/track`
- `POST /api/user/device`
- `POST /api/notifications/:notificationId/read`
- `POST /api/notifications/:notificationId/click`
- 기존 지시/로그/승인 API 전체 유지

## 참고 사항

- 로그 적재는 비동기 처리로 응답 성능에 미치는 영향을 최소화했습니다.
- `last_active_at`은 일정 간격으로만 갱신합니다.
- 알림 발송 실패도 삭제하지 않고 상태로만 누적해 감사 추적 원칙을 유지합니다.
