import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
}

test("초기 사용자 시드는 중복 실행 안전성과 비밀번호 변경 유도를 포함한다", () => {
  const seed = read("scripts/seed-initial-users.mjs");
  const migration = read("supabase/migrations/202605030001_admin_users_meetings_followup.sql");
  const verificationSql = read("scripts/verify-initial-users.sql");
  const verificationScript = read("scripts/verify-initial-users.mjs");

  assert.match(seed, /INITIAL_USER_PASSWORD\s*=\s*["']8639["']/);
  assert.match(seed, /loadEnvFile\("\.env\.local"\)/);
  assert.match(seed, /createUser/);
  assert.match(seed, /updateUserById/);
  assert.match(seed, /onConflict:\s*["']email["']/);
  assert.match(seed, /must_change_password:\s*true/);
  assert.match(seed, /code:\s*"ALL"/);
  assert.match(seed, /code:\s*"MANAGEMENT_CENTER"/);
  assert.match(seed, /code:\s*"SALES_HQ"/);
  assert.match(seed, /code:\s*"PURCHASE_LOGISTICS"/);
  assert.match(seed, /code:\s*"FACTORY_HQ"/);
  assert.match(seed, /const results = \[\]/);
  assert.match(seed, /console\.table\(results\)/);
  assert.match(seed, /status:\s*"성공"/);
  assert.match(seed, /status:\s*"실패"/);
  assert.match(seed, /초기 사용자 등록 실패/);
  assert.match(seed, /existing\.find\(\(item\) => item\.code === department\.code\)\s*\?\?/);
  assert.match(seed, /isPasswordPolicyError/);
  assert.match(seed, /passwordFallbackPayload/);
  assert.match(seed, /canSignInWithInitialPassword/);
  assert.match(seed, /recreateAuthUserWithInitialPassword/);
  assert.match(seed, /deleteUser\(existing\.id\)/);
  assert.match(migration, /must_change_password/i);
  assert.match(verificationScript, /EXPECTED_USERS/);
  assert.match(verificationScript, /EXPECTED_USERS\.length !== 13/);
  assert.match(verificationScript, /EXPECTED_DEPARTMENTS\.length !== 5/);
  assert.match(verificationScript, /auth_user_id/);
  assert.match(verificationScript, /is_active/);
  assert.match(verificationScript, /seanfood\.local/);
  assert.match(verificationScript, /console\.table\(results\)/);
  assert.match(verificationScript, /process\.exitCode = 1/);
  assert.doesNotMatch(verificationScript, /8639/);

  for (const email of [
    "ceo@seanfood.com",
    "chae.hs@seanfood.com",
    "dsbae@seanfood.com",
    "kim.dh@seanfood.com",
    "choi.yw@seanfood.com",
    "you.gy@seanfood.com",
    "kim.dj@seanfood.com",
    "kim.dh2@seanfood.com",
    "yoo.jy@seanfood.com",
    "cho.ks@seanfood.com",
    "yoo.sh@seanfood.com",
    "kwon.os@seanfood.local",
    "kim.jh@seanfood.local",
  ]) {
    assert.match(seed, new RegExp(email.replaceAll(".", "\\.")));
    assert.match(verificationSql, new RegExp(email.replaceAll(".", "\\.")));
    assert.match(verificationScript, new RegExp(email.replaceAll(".", "\\.")));
  }
});

test("대표 대시보드 KPI에 대기 카드와 전체 상태 조회가 유지된다", () => {
  const dashboard = read("src/components/dashboard/ceo-dashboard-client.tsx");

  assert.match(dashboard, /label:\s*"대기"/);
  assert.match(dashboard, /status:\s*"NEW"/);
  assert.match(dashboard, /selectGlobalStatus\("NEW",\s*false\)/);
  assert.match(dashboard, /selectGlobalStatus\("COMPLETION_REQUESTED",\s*false\)/);
  assert.match(dashboard, /selectGlobalStatus\(null,\s*true\)/);
  assert.match(dashboard, /xl:grid-cols-7/);
});

test("우측 확인창은 compact 리스트와 날짜순 정렬 조작을 제공한다", () => {
  const panel = read("src/components/ceo/DepartmentDirectivePanel.tsx");
  const list = read("src/components/ceo/DirectiveList.tsx");

  assert.match(panel, /최신순/);
  assert.match(panel, /오래된순/);
  assert.match(panel, /sortOrder/);
  assert.match(list, /관리번호/);
  assert.match(list, /최근 기준/);
  assert.match(list, /긴급/);
  assert.match(list, /min-w-\[54rem\]/);
  assert.match(list, /truncate/);
  assert.doesNotMatch(list, /<article\b/);
});

test("후속 지시는 권한 있는 사용자만 추가하고 일반 사용자는 직접 완료할 수 없다", () => {
  const constants = read("src/features/directives/constants.ts");
  const service = read("src/features/directives/service.ts");
  const route = read("src/app/api/directives/[directiveId]/follow-ups/route.ts");
  const page = read("src/app/directives/[directiveId]/page.tsx");
  const panel = read("src/components/directives/follow-up-directive-panel.tsx");

  assert.match(constants, /FOLLOW_UP_DIRECTIVE/);
  assert.match(constants, /후속 지시/);
  assert.match(service, /createFollowUpDirectiveLogAsSession/);
  assert.match(service, /isAdminRole\(session\.role\)/);
  assert.match(route, /추가 지시/);
  assert.match(page, /FollowUpDirectivePanel/);
  assert.match(panel, /추가 지시 등록/);
  assert.match(service, /완료 권한이 없습니다/);
});

test("완료 권한은 완료 요청과 승인권자 최종 완료로 분리되어 있다", () => {
  const authConstants = read("src/features/auth/constants.ts");
  const authUtils = read("src/features/auth/utils.ts");
  const service = read("src/features/directives/service.ts");
  const completeRoute = read("src/app/api/directives/[directiveId]/complete-all/route.ts");
  const requestRoute = read("src/app/api/directives/[directiveId]/request-completion/route.ts");
  const approveRoute = read("src/app/api/directives/[directiveId]/approve-completion/route.ts");
  const completePanel = read("src/components/directives/super-admin-complete-panel.tsx");
  const workflowPanel = read("src/components/directives/workflow-action-panel.tsx");
  const completeGuard = service.slice(
    service.indexOf("function canCompleteDirectiveAsSuperAdmin"),
    service.indexOf("function canShowDirectiveCompletionRequest"),
  );
  const requestBody = service.slice(
    service.indexOf("export async function requestDirectiveCompletionAsSession"),
    service.indexOf("export async function approveDirectiveCompletionAsSession"),
  );
  const approveBody = service.slice(
    service.indexOf("export async function approveDirectiveCompletionAsSession"),
    service.indexOf("export async function rejectDirectiveCompletionAsSession"),
  );

  assert.match(authConstants, /executiveRoles = \["CEO", "SUPER_ADMIN"\]/);
  assert.match(authUtils, /isAdminRole\(role\)/);
  assert.match(authUtils, /canApproveDirective\(role: UserRole\)/);
  assert.match(completeGuard, /isAdminRole\(session\.role\)/);
  assert.doesNotMatch(completeGuard, /STAFF|DEPARTMENT_HEAD/);
  assert.match(completeRoute, /completeDirectiveAsSuperAdmin/);
  assert.doesNotMatch(completeRoute, /requestDirectiveCompletionAsSession/);
  assert.match(completePanel, /담당자는 이 완료 처리를 직접 할 수 없습니다/);
  assert.match(requestRoute, /requestDirectiveCompletionAsSession/);
  assert.match(requestBody, /canRequestCompletion/);
  assert.match(requestBody, /DIRECTIVE_COMPLETION_REQUESTED/);
  assert.match(workflowPanel, /완료 요청/);
  assert.match(approveRoute, /approveDirectiveCompletionAsSession/);
  assert.match(approveBody, /canApproveDirective\(session\.role\)/);
  assert.match(approveBody, /DIRECTIVE_APPROVE_DENIED/);
});

test("회의록 관리는 저장, 분석, 선택 등록 흐름을 제공한다", () => {
  const migration = read("supabase/migrations/202605030001_admin_users_meetings_followup.sql");
  const service = read("src/features/meetings/service.ts");
  const page = read("src/app/meetings/page.tsx");
  const appFrame = read("src/components/app/app-frame.tsx");
  const analyzeBody = service.slice(
    service.indexOf("export async function analyzeMeetingAsSession"),
    service.indexOf("export async function registerSelectedMeetingDraftsAsSession"),
  );
  const registerBody = service.slice(service.indexOf("export async function registerSelectedMeetingDraftsAsSession"));

  assert.match(migration, /create table if not exists public\.meeting_records/i);
  assert.match(migration, /create table if not exists public\.meeting_directive_drafts/i);
  assert.match(service, /analyzeMeetingContent/);
  assert.match(service, /해야 한다|추진|검토|정리|보고|확인|교육|등록|관리/);
  assert.match(service, /registerSelectedMeetingDraftsAsSession/);
  assert.match(analyzeBody, /meeting_directive_drafts/);
  assert.match(analyzeBody, /MEETING_ANALYZED/);
  assert.doesNotMatch(analyzeBody, /createDirectiveAsSession/);
  assert.match(registerBody, /\.eq\("is_selected", true\)/);
  assert.match(registerBody, /\.eq\("status", "DRAFT"\)/);
  assert.match(registerBody, /includeAllDepartment/);
  assert.match(registerBody, /targetScope: targetDepartmentIds\.length === departments\.length \? "ALL" : "SELECTED"/);
  assert.match(page, /회의실 입장/);
  assert.match(appFrame, /회의실 입장/);
});

test("회의 메뉴와 화면 문구는 회의실 입장 기준으로 표시된다", () => {
  const page = read("src/app/meetings/page.tsx");
  const appFrame = read("src/components/app/app-frame.tsx");
  const client = read("src/components/meetings/meeting-management-client.tsx");

  assert.match(page, /회의실 입장/);
  assert.match(appFrame, /회의실 입장/);
  assert.match(client, /신규 회의 등록/);
  assert.match(client, /회의 목록/);
  assert.match(client, /회의 구분/);
  assert.match(client, /회의 내용/);
  assert.match(client, /지시사항 미리보기/);
  assert.doesNotMatch(page, /회의록 관리/);
  assert.doesNotMatch(appFrame, /회의록 관리/);
});

test("회의 목록은 수정과 비노출 삭제를 제공하고 실제 삭제를 사용하지 않는다", () => {
  const migration = read("supabase/migrations/202605030002_meeting_room_management.sql");
  const service = read("src/features/meetings/service.ts");
  const route = read("src/app/api/meetings/[meetingId]/route.ts");
  const client = read("src/components/meetings/meeting-management-client.tsx");

  assert.match(migration, /deleted_at timestamptz/i);
  assert.match(migration, /deleted_by uuid/i);
  assert.match(migration, /file_name text/i);
  assert.match(migration, /file_url text/i);
  assert.match(service, /updateMeetingRecordAsSession/);
  assert.match(service, /softDeleteMeetingRecordAsSession/);
  assert.match(service, /is_deleted:\s*true/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.match(client, /회의일/);
  assert.match(client, /회의 구분/);
  assert.match(client, /등록자/);
  assert.match(client, /첨부/);
  assert.match(client, /분석 상태/);
  assert.match(client, /수정/);
  assert.match(client, /삭제/);
  assert.match(client, /회의를 목록에서 숨기겠습니까/);
  assert.match(client, /실제 데이터는 삭제되지 않으며 개발자가 복구할 수 있습니다/);
});

test("개발자 도구는 슈퍼관리자 전용 오류 관리 흐름을 제공한다", () => {
  const migration = read("supabase/migrations/202605030003_developer_error_logs.sql");
  const appFrame = read("src/components/app/app-frame.tsx");
  const page = read("src/app/developer/page.tsx");
  const listRoute = read("src/app/api/developer/error-logs/route.ts");
  const itemRoute = read("src/app/api/developer/error-logs/[id]/route.ts");
  const client = read("src/components/developer/developer-tools-client.tsx");

  assert.match(migration, /create table if not exists public\.developer_error_logs/i);
  assert.match(migration, /screenshot_data text null/i);
  assert.match(migration, /status text not null default 'OPEN'/i);
  assert.match(appFrame, /href:\s*"\/developer"/);
  assert.match(appFrame, /label:\s*"개발자 도구"/);
  assert.match(appFrame, /session\.role === "SUPER_ADMIN"/);
  assert.match(page, /접근 권한이 없습니다/);
  assert.match(page, /DeveloperToolsClient/);
  assert.match(listRoute, /export async function POST/);
  assert.match(listRoute, /export async function GET/);
  assert.match(listRoute, /createDeveloperErrorLog/);
  assert.match(listRoute, /listDeveloperErrorLogsAsSession/);
  assert.match(itemRoute, /export async function PATCH/);
  assert.match(itemRoute, /updateDeveloperErrorLogAsSession/);
  assert.match(client, /전체/);
  assert.match(client, /미조치/);
  assert.match(client, /조치중/);
  assert.match(client, /해결/);
  assert.match(client, /오늘/);
  assert.match(client, /검색/);
  assert.match(client, /상세 패널/);
  assert.match(client, /조치 메모 저장/);
  assert.match(client, /해결 처리/);
});

test("전역 오류 화면은 한국어로 표시되고 개발자 오류 로그 전송을 시도한다", () => {
  const appError = read("src/app/error.tsx");
  const globalError = read("src/app/global-error.tsx");
  const reporter = read("src/components/developer/error-reporting-client.tsx");
  const layout = read("src/app/layout.tsx");

  for (const source of [appError, globalError]) {
    assert.match(source, /화면을 불러오지 못했습니다/);
    assert.match(source, /일시적인 오류가 발생했습니다\. 다시 시도해주세요/);
    assert.match(source, /다시 불러오기/);
    assert.match(source, /홈으로 이동/);
    assert.match(source, /\/api\/developer\/error-logs/);
    assert.doesNotMatch(source, /This page couldn/);
  }

  assert.match(reporter, /window\.addEventListener\("error"/);
  assert.match(reporter, /window\.addEventListener\("unhandledrejection"/);
  assert.match(reporter, /routePath/);
  assert.match(reporter, /browserInfo/);
  assert.match(reporter, /appState/);
  assert.match(layout, /ErrorReportingClient/);
});

test("PWA 설치 조건과 로그인 후 설치 안내를 제공한다", () => {
  const manifest = read("public/manifest.webmanifest");
  const serviceWorker = read("public/sw.js");
  const layout = read("src/app/layout.tsx");
  const appFrame = read("src/components/app/app-frame.tsx");
  const prompt = read("src/components/app/pwa-install-prompt.tsx");

  assert.match(manifest, /"name":\s*"CN EXEFLOW"/);
  assert.match(manifest, /"short_name":\s*"CN EXEFLOW"/);
  assert.match(manifest, /"start_url":\s*"\/dashboard\/ceo"/);
  assert.match(manifest, /"display":\s*"standalone"/);
  assert.match(manifest, /"src":\s*"\/icons\/icon-192\.png"/);
  assert.match(manifest, /"src":\s*"\/icons\/icon-512\.png"/);
  assert.match(manifest, /"purpose":\s*"any maskable"/);
  for (const iconPath of ["public/icons/icon-192.png", "public/icons/icon-512.png"]) {
    const absoluteIconPath = path.join(root, iconPath);
    assert.ok(fs.existsSync(absoluteIconPath));
    const iconHeader = fs.readFileSync(absoluteIconPath).subarray(0, 8).toString("hex");
    assert.equal(iconHeader, "89504e470d0a1a0a");
  }
  assert.match(serviceWorker, /self\.addEventListener\("fetch"/);
  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest"/);
  assert.match(layout, /themeColor:\s*"#07203f"/);
  assert.match(appFrame, /PwaInstallPrompt/);
  assert.match(prompt, /beforeinstallprompt/);
  assert.match(prompt, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(prompt, /휴대폰에 앱으로 설치할 수 있습니다/);
  assert.match(prompt, /설치하면 다음부터 바로 실행할 수 있습니다/);
  assert.match(prompt, /앱 설치하기/);
  assert.match(prompt, /나중에/);
  assert.match(prompt, /공유 버튼을 누른 뒤 홈 화면에 추가를 선택해주세요/);
  assert.match(prompt, /7 \* 24 \* 60 \* 60 \* 1000/);
});

test("로그인 화면은 비밀번호 저장 없이 자동 로그인 체크를 제공한다", () => {
  const loginForm = read("src/components/auth/login-form.tsx");
  const loginPage = read("src/app/login/page.tsx");
  const authService = read("src/features/auth/service.ts");

  assert.match(loginForm, /자동 로그인/);
  assert.match(loginForm, /개인 휴대폰에서만 사용해주세요/);
  assert.match(loginForm, /rememberMe/);
  assert.doesNotMatch(loginForm, /localStorage\.setItem\([^)]*password/i);
  assert.doesNotMatch(loginForm, /localStorage\.setItem\([^)]*비밀번호/i);
  assert.match(loginPage, /if \(session\)/);
  assert.match(loginPage, /redirect\(getDefaultAppRoute\(session\.role\)\)/);
  assert.match(authService, /APP_SESSION_MAX_AGE_REMEMBER_SECONDS/);
  assert.match(authService, /APP_SESSION_MAX_AGE_DEFAULT_SECONDS/);
  assert.match(authService, /rememberMe \? APP_SESSION_MAX_AGE_REMEMBER_SECONDS : APP_SESSION_MAX_AGE_DEFAULT_SECONDS/);
});

test("비밀번호 재설정 링크는 운영 도메인과 전용 재설정 화면을 사용한다", () => {
  const resetRoute = read("src/app/api/auth/reset-password/route.ts");
  const authService = read("src/features/auth/service.ts");
  const callbackRoute = read("src/app/auth/callback/route.ts");
  const resetPage = read("src/app/reset-password/page.tsx");
  const resetClient = read("src/components/auth/reset-password-client.tsx");
  const loginForm = read("src/components/auth/login-form.tsx");
  const envExample = read(".env.example");
  const readme = read("README.md");

  assert.match(envExample, /NEXT_PUBLIC_APP_URL=https:\/\/cn-exe-flow\.vercel\.app/);
  assert.match(authService, /NEXT_PUBLIC_APP_URL/);
  assert.match(authService, /cn-exe-flow\.vercel\.app/);
  assert.match(authService, /\/reset-password/);
  assert.match(authService, /resetPasswordForEmail\(email,\s*{\s*redirectTo/s);
  assert.match(resetRoute, /requestPasswordReset\(\{\s*email: parsed\.data\.email\s*}\)/s);
  assert.doesNotMatch(resetRoute, /new URL\(request\.url\)\.origin/);
  assert.doesNotMatch(resetRoute, /window\.location\.origin/);
  assert.match(callbackRoute, /getPasswordResetRedirectTo/);
  assert.match(callbackRoute, /\/reset-password/);
  assert.match(callbackRoute, /code/);
  assert.match(callbackRoute, /token_hash/);
  assert.match(callbackRoute, /otp_expired/);
  assert.match(resetPage, /ResetPasswordClient/);
  assert.match(resetPage, /return\s+<ResetPasswordClient\s*\/>/);
  assert.match(resetClient, /비밀번호 재설정/);
  assert.match(resetClient, /새 비밀번호/);
  assert.match(resetClient, /새 비밀번호 확인/);
  assert.match(resetClient, /비밀번호 변경하기/);
  assert.match(resetClient, /비밀번호를 변경했습니다/);
  assert.match(resetClient, /다시 로그인해주세요/);
  assert.match(resetClient, /비밀번호 재설정 화면을 준비하고 있습니다/);
  assert.match(resetClient, /인증 정보를 확인하는 중입니다/);
  assert.match(resetClient, /비밀번호 재설정 인증이 필요합니다/);
  assert.match(resetClient, /메일의 재설정 링크를 다시 열어주세요/);
  assert.match(resetClient, /비밀번호 재설정 링크가 만료되었습니다/);
  assert.match(resetClient, /다시 재설정 메일을 요청해주세요/);
  assert.match(resetClient, /재설정 메일 다시 받기/);
  assert.match(resetClient, /재설정 메일 다시 보내기/);
  assert.match(resetClient, /비밀번호 재설정 메일을 보냈습니다/);
  assert.match(resetClient, /메일의 안내에 따라 다시 설정해주세요/);
  assert.match(resetClient, /otp_expired/);
  assert.match(resetClient, /error_description/);
  assert.match(resetClient, /exchangeCodeForSession/);
  assert.match(resetClient, /verifyOtp/);
  assert.match(resetClient, /getSession/);
  assert.match(resetClient, /updateUser\(\{\s*password/s);
  assert.doesNotMatch(resetClient, /return\s+null/);
  assert.doesNotMatch(resetClient, /useSearchParams/);
  assert.match(loginForm, /searchParams\.get\("mode"\) === "reset"/);
  assert.match(readme, /Supabase Dashboard → Authentication → URL Configuration/);
  assert.match(readme, /Site URL:\s*https:\/\/cn-exe-flow\.vercel\.app/);
  assert.match(readme, /https:\/\/cn-exe-flow\.vercel\.app\/reset-password/);
  assert.doesNotMatch(resetClient, /This page couldn|Expired|Reset password|Retry/);
});

test("슈퍼관리자 사용자 화면 전환은 서버 세션을 바꾸지 않고 브라우저 상태만 사용한다", () => {
  const authService = read("src/features/auth/service.ts");
  const appHeader = read("src/components/app/app-header.tsx");
  const switcher = read("src/components/app/impersonation-switcher.tsx");
  const route = read("src/app/api/admin/impersonation/route.ts");
  const auditRoute = read("src/app/api/admin/impersonation/audit/route.ts");
  const constants = read("src/features/auth/constants.ts");
  const sessionTypes = read("src/features/auth/types.ts");

  assert.doesNotMatch(constants, /APP_IMPERSONATION_COOKIE/);
  assert.doesNotMatch(sessionTypes, /impersonation\?:/);
  assert.doesNotMatch(authService, /startImpersonationAsSession/);
  assert.doesNotMatch(authService, /stopImpersonationAsSession/);
  assert.doesNotMatch(authService, /applyImpersonation/);
  assert.doesNotMatch(authService, /decodeImpersonationCookie/);
  assert.doesNotMatch(authService, /setImpersonationCookie/);
  assert.doesNotMatch(authService, /cookieStore\.set\(APP_IMPERSONATION_COOKIE/);
  assert.doesNotMatch(authService, /cookieStore\.delete\(APP_IMPERSONATION_COOKIE/);
  assert.doesNotMatch(route, /POST\(request/);
  assert.doesNotMatch(route, /DELETE\(/);
  assert.doesNotMatch(route, /readJsonBody/);
  assert.doesNotMatch(route, /startImpersonationAsSession|stopImpersonationAsSession/);
  assert.match(route, /getCurrentSession/);
  assert.match(switcher, /cn\.impersonation/);
  assert.match(switcher, /localStorage\.setItem/);
  assert.match(switcher, /localStorage\.removeItem/);
  assert.match(switcher, /\/api\/admin\/impersonation\/audit/);
  assert.match(switcher, /IMPERSONATION_STARTED/);
  assert.match(switcher, /IMPERSONATION_ENDED/);
  assert.match(switcher, /사용자 화면 전환/);
  assert.match(switcher, /대리 확인 중/);
  assert.match(switcher, /슈퍼관리자로 돌아가기/);
  assert.match(switcher, /NEXT_PUBLIC_ENABLE_IMPERSONATION/);
  assert.match(switcher, /ENABLE_IMPERSONATION_SWITCHER\s*=\s*process\.env\.NEXT_PUBLIC_ENABLE_IMPERSONATION === "true"/);
  assert.match(switcher, /if \(!ENABLE_IMPERSONATION_SWITCHER\)/);
  assert.match(appHeader, /ENABLE_IMPERSONATION_SWITCHER/);
  assert.match(auditRoute, /POST\(request: Request\)/);
  assert.match(auditRoute, /requireAdminApiSession/);
  assert.match(auditRoute, /recordHistory/);
  assert.match(auditRoute, /audit_logs|recordHistory/);
  assert.match(auditRoute, /IMPERSONATION_STARTED/);
  assert.match(auditRoute, /IMPERSONATION_ENDED/);
  assert.match(auditRoute, /actorId: session\.userId/);
  assert.doesNotMatch(auditRoute, /APP_SESSION_COOKIE|APP_IMPERSONATION_COOKIE/);
  assert.doesNotMatch(auditRoute, /auth\.setSession|updateUser|cookieStore\.set|cookieStore\.delete/);
});

test("새로 추가된 사용자 노출 문구는 한국어만 사용한다", () => {
  const files = [
    "src/components/meetings/meeting-management-client.tsx",
    "src/components/app/impersonation-switcher.tsx",
    "src/components/directives/follow-up-directive-panel.tsx",
    "src/components/ceo/DirectiveList.tsx",
  ];
  const forbiddenVisibleWords = [
    "Loading",
    "Error",
    "Retry",
    "Dashboard",
    "Department",
    "Status",
    "Detail",
    "View",
    "Filter",
    "Pending",
    "Complete",
    "Urgent",
    "No data",
  ];

  for (const file of files) {
    const source = read(file);
    for (const word of forbiddenVisibleWords) {
      assert.doesNotMatch(source, new RegExp(`>\\s*[^<>{\\n]*${word}[^<>{\\n]*\\s*<`), `${file} contains visible English word ${word}`);
      assert.doesNotMatch(source, new RegExp(`\\b(aria-label|title|placeholder)=["'][^"']*${word}[^"']*["']`), `${file} contains visible English word ${word}`);
    }
  }
});
