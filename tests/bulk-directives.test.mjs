import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

test("데이터 일괄관리 메뉴와 접근 제어는 대표와 슈퍼관리자 기준으로 제공된다", () => {
  const appFrame = read("src/components/app/app-frame.tsx");
  const page = read("src/app/admin/bulk-data/page.tsx");

  assert.match(appFrame, /href:\s*"\/admin\/bulk-data"/);
  assert.match(appFrame, /label:\s*"데이터 일괄관리"/);
  assert.match(page, /getCurrentSession/);
  assert.match(page, /isAdminRole\(session\.role\)/);
  assert.match(page, /접근 권한이 없습니다/);
  assert.match(page, /BulkDataManagementClient/);
});

test("엑셀 양식 다운로드 파일과 안내 시트 기준이 존재한다", () => {
  const constants = read("src/features/bulk-directives/constants.ts");
  const client = read("src/components/admin/bulk-data-management-client.tsx");
  const templatePath = "public/templates/CN_EXEFLOW_지시사항_일괄등록_양식.xlsx";
  const file = fs.readFileSync(path.join(root, templatePath));

  assert.equal(exists(templatePath), true);
  assert.equal(file.subarray(0, 2).toString("utf8"), "PK");
  assert.match(constants, /회의일/);
  assert.match(constants, /주관/);
  assert.match(constants, /지시사항/);
  assert.match(constants, /담당부서/);
  assert.match(constants, /경영관리센터/);
  assert.match(constants, /공장총괄본부/);
  assert.match(constants, /승인 대기/);
  assert.match(client, /엑셀 양식 다운로드/);
  assert.match(client, /BULK_DIRECTIVE_TEMPLATE_PATH/);
});

test("미리보기 API는 파일 파싱과 필수 컬럼·부서·상태 검증을 수행한다", () => {
  const route = read("src/app/api/admin/bulk-directives/preview/route.ts");
  const service = read("src/features/bulk-directives/service.ts");

  assert.match(route, /export async function POST/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /previewBulkDirectivesAsSession/);
  assert.match(service, /parseXlsxBuffer/);
  assert.match(service, /parseCsvText/);
  assert.match(service, /BULK_DIRECTIVE_REQUIRED_COLUMNS/);
  assert.match(service, /담당부서를 입력해주세요/);
  assert.match(service, /허용되지 않는 부서입니다/);
  assert.match(service, /허용되지 않는 상태입니다/);
  assert.match(service, /회의일/);
  assert.match(service, /todayDateValue/);
});

test("일괄 등록은 미리보기 행만 선택 등록하고 관리번호 중복을 방지한다", () => {
  const route = read("src/app/api/admin/bulk-directives/register/route.ts");
  const service = read("src/features/bulk-directives/service.ts");
  const migration = read("supabase/migrations/202605050001_bulk_directive_imports.sql");

  assert.match(route, /bulkDirectiveRegisterSchema/);
  assert.match(service, /batch\.status !== "PREVIEW"/);
  assert.match(service, /\.in\("id", input\.selectedRowIds\)/);
  assert.match(service, /row\.directive_id/);
  assert.match(service, /generateDirectiveNumber/);
  assert.match(service, /CN-\$\{year\}-\$\{month\}-/);
  assert.match(service, /MAX_DIRECTIVE_NO_RETRIES/);
  assert.match(service, /\.from\("directives"\)\s*\n\s*\.insert/);
  assert.match(service, /\.from\("directive_departments"\)\.insert/);
  assert.match(service, /\.is\("directive_id", null\)/);
  assert.match(migration, /constraint bulk_import_rows_directive_unique unique \(directive_id\)/);
});

test("일괄 비노출은 하드 삭제 없이 복구 정보를 남긴다", () => {
  const route = read("src/app/api/admin/bulk-directives/archive/route.ts");
  const service = read("src/features/bulk-directives/service.ts");
  const migration = read("supabase/migrations/202605050001_bulk_directive_imports.sql");

  assert.match(route, /bulkDirectiveArchiveSchema/);
  assert.match(service, /비노출 사유를 입력해주세요/);
  assert.match(service, /is_archived:\s*true/);
  assert.match(service, /archived_at/);
  assert.match(service, /archived_by/);
  assert.match(service, /archive_reason/);
  assert.match(service, /status:\s*"CANCELED"/);
  assert.match(service, /BULK_DIRECTIVES_ARCHIVED/);
  assert.match(migration, /archive_reason text null/);
  assert.match(migration, /archived_at timestamptz null/);
  assert.doesNotMatch(service, /\.delete\(/);
  assert.doesNotMatch(route, /\.delete\(/);
});

test("일괄관리 화면은 한국어 미리보기와 등록 내역, 비노출 흐름을 제공한다", () => {
  const client = read("src/components/admin/bulk-data-management-client.tsx");

  assert.match(client, /지시사항 일괄등록/);
  assert.match(client, /등록 내역/);
  assert.match(client, /일괄 비노출/);
  assert.match(client, /검증 완료/);
  assert.match(client, /등록 가능/);
  assert.match(client, /수정 필요/);
  assert.match(client, /선택한 지시사항 등록/);
  assert.match(client, /오류가 있는 행은 등록할 수 없습니다/);
  assert.match(client, /실제 데이터는 삭제되지 않으며 개발자가 복구할 수 있습니다/);
  assert.match(client, /비노출 사유를 입력해주세요/);
  for (const word of [
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
  ]) {
    assert.equal(client.includes(`>${word}<`), false);
    assert.equal(client.includes(`aria-label="${word}"`), false);
    assert.equal(client.includes(`placeholder="${word}"`), false);
  }
});
