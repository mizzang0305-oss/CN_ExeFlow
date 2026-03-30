import type { AuthActivityEventType, UserActivityType } from "./types";

export const authActivityEventLabels: Record<AuthActivityEventType, string> = {
  LOGIN_FAILED: "로그인 실패",
  LOGIN_SUCCESS: "로그인 성공",
  LOGOUT: "로그아웃",
  SESSION_EXPIRED: "세션 만료",
};

export const userActivityLabels: Record<UserActivityType, string> = {
  APPROVAL_CLICK: "승인 처리",
  APPROVAL_QUEUE_VIEW: "승인 대기 조회",
  ATTACHMENT_UPLOAD: "증빙 업로드",
  CEO_DASHBOARD_VIEW: "CEO 대시보드 조회",
  COMPLETION_REQUEST_CLICK: "완료 요청",
  DASHBOARD_VIEW: "대시보드 진입",
  DEPARTMENT_BOARD_VIEW: "부서 실행 보드 조회",
  DIRECTIVE_DETAIL_VIEW: "지시 상세 조회",
  DIRECTIVE_LIST_VIEW: "지시 목록 조회",
  DIRECTIVE_LOG_CREATE: "로그 등록",
  NOTIFICATION_INBOX_VIEW: "알림함 조회",
  NOTIFICATION_PERMISSION_DENIED: "알림 권한 거부",
  NOTIFICATION_PERMISSION_GRANTED: "알림 권한 허용",
  REJECTION_CLICK: "반려 처리",
  STAFF_HOME_VIEW: "실무자 홈 조회",
  UNAUTHORIZED_API_ACCESS: "권한 없는 API 접근",
  UNAUTHORIZED_ROUTE_ACCESS: "권한 없는 경로 접근",
  VIEWER_HOME_VIEW: "조회 전용 홈 조회",
};
