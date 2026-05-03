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
  assert.match(list, /최근 기준일/);
  assert.match(list, /긴급 여부/);
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

test("회의록 관리는 저장, 분석, 선택 등록 흐름을 제공한다", () => {
  const migration = read("supabase/migrations/202605030001_admin_users_meetings_followup.sql");
  const service = read("src/features/meetings/service.ts");
  const page = read("src/app/meetings/page.tsx");
  const appFrame = read("src/components/app/app-frame.tsx");

  assert.match(migration, /create table if not exists public\.meeting_records/i);
  assert.match(migration, /create table if not exists public\.meeting_directive_drafts/i);
  assert.match(service, /analyzeMeetingContent/);
  assert.match(service, /해야 한다|추진|검토|정리|보고|확인|교육|등록|관리/);
  assert.match(service, /registerSelectedMeetingDraftsAsSession/);
  assert.match(page, /회의록 관리/);
  assert.match(appFrame, /회의록 관리/);
});

test("슈퍼관리자 사용자 화면 전환은 세션 변경 없이 대리 확인 배너와 감사 기록을 남긴다", () => {
  const authService = read("src/features/auth/service.ts");
  const switcher = read("src/components/app/impersonation-switcher.tsx");
  const route = read("src/app/api/admin/impersonation/route.ts");

  assert.match(authService, /startImpersonationAsSession/);
  assert.match(authService, /IMPERSONATION_STARTED/);
  assert.match(authService, /impersonation/);
  assert.match(switcher, /사용자 화면 전환/);
  assert.match(switcher, /대리 확인 중/);
  assert.match(switcher, /슈퍼관리자로 돌아가기/);
  assert.match(route, /getCurrentActorSession/);
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
