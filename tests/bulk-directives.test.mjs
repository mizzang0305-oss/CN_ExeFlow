import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function loadBulkDirectiveServiceForTest() {
  const sourcePath = path.join(root, "src/features/bulk-directives/service.ts");
  const source = fs
    .readFileSync(sourcePath, "utf8")
    .replace(
      "function validateAndNormalizeReplaceRow(",
      "export function validateAndNormalizeReplaceRow(",
    );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText;
  const cjsModule = { exports: {} };
  const sandbox = {
    Buffer,
    console,
    crypto,
    exports: cjsModule.exports,
    module: cjsModule,
    process,
    require: (specifier) => {
      if (specifier === "./constants") {
        return {
          BULK_DIRECTIVE_ALLOWED_DEPARTMENTS: [
            "전체",
            "경영관리센터",
            "영업본부",
            "구매물류부",
            "공장총괄본부",
          ],
          BULK_DIRECTIVE_REPLACE_NOTE_COLUMNS: ["비고", "기한"],
          BULK_DIRECTIVE_REQUIRED_COLUMNS: [
            "회의일",
            "주관",
            "지시사항",
            "담당부서",
            "상태",
            "긴급여부",
            "긴급등급",
            "마감일",
            "비고",
          ],
          BULK_DIRECTIVE_REPLACE_REQUIRED_COLUMNS: [
            "No.",
            "회의일",
            "주관",
            "지시사항",
            "담당부서",
            "상태",
          ],
          BULK_DIRECTIVE_STATUS_LABEL_TO_VALUE: {
            대기: "NEW",
            신규: "NEW",
            진행중: "IN_PROGRESS",
            지속: "IN_PROGRESS",
            완료: "COMPLETED",
            반려: "REJECTED",
            승인대기: "COMPLETION_REQUESTED",
            "승인 대기": "COMPLETION_REQUESTED",
            완료요청: "COMPLETION_REQUESTED",
            "완료 요청": "COMPLETION_REQUESTED",
            지연: "DELAYED",
          },
          BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL: {
            COMPLETED: "완료",
            COMPLETION_REQUESTED: "승인 대기",
            DELAYED: "지연",
            IN_PROGRESS: "진행중",
            NEW: "대기",
            REJECTED: "반려",
          },
        };
      }

      if (specifier === "@/features/auth/utils") {
        return { isAdminRole: () => true };
      }

      if (specifier === "@/lib/errors") {
        return {
          ApiError: class ApiError extends Error {
            constructor(status, message, cause, code) {
              super(message);
              this.status = status;
              this.cause = cause;
              this.code = code;
            }
          },
        };
      }

      if (specifier === "@/lib/history") {
        return { recordHistory: async () => undefined };
      }

      if (specifier === "@/lib/supabase") {
        return { createSupabaseServerClient: () => ({}) };
      }

      return require(specifier);
    },
  };

  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return cjsModule.exports;
}

function buildReplaceRow(overrides = {}) {
  return {
    rowNumber: 2,
    values: {
      "No.": "1",
      "회의일": "2026-05-08",
      "주관": "대표",
      "지시사항": "테스트 지시사항",
      "담당부서": "기획영업부",
      "상태": "진행중",
      "기한": "",
      "비고": "",
      "원본시트": "대표이사 지시사항",
      ...overrides,
    },
  };
}

const replaceDepartments = [
  { code: "ALL", headUserId: null, id: "dept-all", name: "전체" },
  { code: "SALES_HQ", headUserId: null, id: "dept-sales", name: "영업본부" },
  { code: "MANAGEMENT_CENTER", headUserId: null, id: "dept-management", name: "경영관리센터" },
  { code: "PURCHASE_LOGISTICS", headUserId: null, id: "dept-purchase", name: "구매물류부" },
  { code: "FACTORY_HQ", headUserId: null, id: "dept-factory", name: "공장총괄본부" },
];

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

test("지시사항 전체 교체 API와 운영 안전장치가 제공된다", () => {
  const previewRoutePath = "src/app/api/admin/bulk-directives/replace-preview/route.ts";
  const registerRoutePath = "src/app/api/admin/bulk-directives/replace-register/route.ts";

  assert.equal(exists(previewRoutePath), true);
  assert.equal(exists(registerRoutePath), true);

  const previewRoute = read(previewRoutePath);
  const registerRoute = read(registerRoutePath);
  const service = read("src/features/bulk-directives/service.ts");
  const schemas = read("src/features/bulk-directives/schemas.ts");

  assert.match(previewRoute, /previewReplaceDirectivesAsSession/);
  assert.match(registerRoute, /registerReplaceDirectivesAsSession/);
  assert.match(schemas, /bulkDirectiveReplaceRegisterSchema/);
  assert.match(schemas, /confirmText/);
  assert.match(schemas, /전체교체/);
  assert.match(service, /DIRECTIVE_REPLACE/);
  assert.match(service, /DIRECTIVE_REPLACE_SOURCE_SHEET_NAMES/);
  assert.match(service, /대표이사 지시사항/);
  assert.match(service, /부사장 지시사항/);
  assert.match(service, /DIRECTIVE_REPLACE_VALIDATION_SHEET_NAME/);
  assert.match(service, /통합 지시사항/);
  assert.match(service, /is_archived:\s*true/);
  assert.match(service, /OLD-\$\{directive\.directive_no\}/);
  assert.match(service, /엑셀 재등록 전 기존 지시사항 전체 비노출/);
  assert.doesNotMatch(service, /\.delete\(/);
  assert.doesNotMatch(previewRoute, /\.delete\(/);
  assert.doesNotMatch(registerRoute, /\.delete\(/);
});

test("엑셀 전체 교체는 원본 시트의 부서와 상태를 운영·보고 기준으로 매핑한다", () => {
  const constants = read("src/features/bulk-directives/constants.ts");
  const service = read("src/features/bulk-directives/service.ts");

  assert.match(constants, /BULK_DIRECTIVE_REPLACE_REQUIRED_COLUMNS/);
  assert.match(constants, /BULK_DIRECTIVE_REPLACE_NOTE_COLUMNS/);
  assert.match(constants, /No\./);
  assert.match(constants, /기한/);
  assert.match(constants, /지속:\s*"IN_PROGRESS"/);
  assert.match(constants, /신규:\s*"NEW"/);
  assert.match(constants, /완료요청:\s*"COMPLETION_REQUESTED"/);
  assert.match(service, /기획영업부["'],\s*["']영업본부/);
  assert.match(service, /구매물류부["'],\s*["']구매물류부/);
  assert.match(service, /전 부서["'],\s*["']전체/);
  assert.match(service, /주식회사 씨엔푸드["'],\s*["']전체/);
  assert.match(service, /HACCP["'],\s*["']경영관리센터/);
  assert.doesNotMatch(service, /HACCP["'],\s*["']공장총괄본부/);
  assert.match(service, /보고상태/);
  assert.match(service, /보고담당부서/);
  assert.match(service, /buildReportDepartmentLabel/);
  assert.match(service, /expandAllDepartment:\s*false/);
  assert.match(service, /targetScope:\s*"SELECTED"/);
  assert.match(service, /resolveDepartments/);
});

test("엑셀 전체 교체는 기한을 비고보다 먼저 due_date로 파싱한다", () => {
  const { validateAndNormalizeReplaceRow } = loadBulkDirectiveServiceForTest();

  const withDueDateAndNote = validateAndNormalizeReplaceRow(
    buildReplaceRow({
      "기한": "2026-05-20",
      "비고": "별도 보고",
    }),
    replaceDepartments,
    new Map(),
  );

  assert.equal(withDueDateAndNote.valid, true);
  assert.equal(withDueDateAndNote.dueDate, "2026-05-20");
  assert.equal(withDueDateAndNote.note, "별도 보고");
  assert.match(withDueDateAndNote.content, /기한: 2026-05-20/);
  assert.match(withDueDateAndNote.content, /비고: 별도 보고/);

  const invalidExplicitDueDate = validateAndNormalizeReplaceRow(
    buildReplaceRow({
      "기한": "invalid-date",
      "비고": "2026-05-20",
    }),
    replaceDepartments,
    new Map(),
  );

  assert.equal(invalidExplicitDueDate.valid, false);
  assert.equal(invalidExplicitDueDate.dueDate, null);
  assert.match(invalidExplicitDueDate.errors.join("\n"), /기한 형식을 확인해주세요/);

  const noteOnly = validateAndNormalizeReplaceRow(
    buildReplaceRow({
      "비고": "별도 보고",
    }),
    replaceDepartments,
    new Map(),
  );

  assert.equal(noteOnly.valid, true);
  assert.equal(noteOnly.dueDate, null);
  assert.equal(noteOnly.note, "별도 보고");
  assert.match(noteOnly.content, /비고: 별도 보고/);

  const noteDateFallback = validateAndNormalizeReplaceRow(
    buildReplaceRow({
      "비고": "2026-05-20",
    }),
    replaceDepartments,
    new Map(),
  );

  assert.equal(noteDateFallback.valid, true);
  assert.equal(noteDateFallback.dueDate, "2026-05-20");
  assert.equal(noteDateFallback.note, "2026-05-20");
  assert.match(noteDateFallback.content, /비고: 2026-05-20/);
});

test("지시사항 전체 교체 UI는 미리보기와 확인 문구를 거친다", () => {
  const client = read("src/components/admin/bulk-data-management-client.tsx");

  assert.match(client, /지시사항 전체 교체/);
  assert.match(client, /기존 지시사항은 화면에서 모두 숨겨지고, 엑셀 데이터로 새로 등록됩니다/);
  assert.match(client, /실제 데이터는 삭제되지 않으며 개발자가 복구할 수 있습니다/);
  assert.match(client, /기존 활성 지시사항/);
  assert.match(client, /관리번호 예정/);
  assert.match(client, /기존 지시사항 비노출 후 등록/);
  assert.match(client, /전체교체/);
  assert.match(client, /replace-preview/);
  assert.match(client, /replace-register/);
});

test("지시사항 전체 교체 마이그레이션은 복구 가능 정보를 보존한다", () => {
  const migration = read("supabase/migrations/202605050002_directive_replace_imports.sql");

  assert.match(migration, /DIRECTIVE_REPLACE/);
  assert.match(migration, /replace_mode boolean/);
  assert.match(migration, /archived_directives_count int/);
  assert.match(migration, /archive_reason text null/);
  assert.match(migration, /archived_at timestamptz null/);
});
