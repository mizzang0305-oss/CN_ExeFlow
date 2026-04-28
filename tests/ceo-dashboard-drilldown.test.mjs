import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

import ts from "typescript";

const rootDir = process.cwd();
const require = createRequire(import.meta.url);

function loadTypeScriptModule(relativePath) {
  const sourcePath = path.join(rootDir, relativePath);
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText;

  const cjsModule = { exports: {} };
  const sandbox = {
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  };

  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return cjsModule.exports;
}

const forbiddenVisibleWords = [
  "Loading",
  "Dashboard",
  "Department",
  "Status",
  "Complete",
  "Pending",
  "Urgent",
  "Error",
  "Retry",
  "No data",
  "View",
  "Detail",
  "Filter",
];

test("대표 대시보드 상태 라벨은 한국어 고정값을 사용한다", () => {
  const {
    DIRECTIVE_STATUS_LABELS,
    STATUS_FILTER_OPTIONS,
    URGENT_STATUS_LABEL,
  } = loadTypeScriptModule("src/lib/constants/status-labels.ts");

  assert.equal(DIRECTIVE_STATUS_LABELS.NEW, "신규");
  assert.equal(DIRECTIVE_STATUS_LABELS.IN_PROGRESS, "진행중");
  assert.equal(DIRECTIVE_STATUS_LABELS.COMPLETION_REQUESTED, "승인 대기");
  assert.equal(DIRECTIVE_STATUS_LABELS.DELAYED, "지연");
  assert.equal(DIRECTIVE_STATUS_LABELS.COMPLETED, "완료");
  assert.equal(DIRECTIVE_STATUS_LABELS.REJECTED, "반려");
  assert.equal(URGENT_STATUS_LABEL, "긴급");

  const visibleLabels = [
    ...Object.values(DIRECTIVE_STATUS_LABELS),
    ...STATUS_FILTER_OPTIONS.map((option) => option.label),
    URGENT_STATUS_LABEL,
  ].join(" ");

  for (const word of forbiddenVisibleWords) {
    assert.equal(visibleLabels.includes(word), false, `${word} 문구가 노출 라벨에 남아 있습니다.`);
  }
});

test("대표 지시사항 쿼리는 잘못된 상태를 전체로 돌리고 한도를 제한한다", () => {
  const { normalizeCeoDirectiveQuery } = loadTypeScriptModule("src/lib/constants/status-labels.ts");
  const params = new URLSearchParams({
    departmentId: "영업본부_ID",
    limit: "500",
    page: "0",
    status: "UNKNOWN",
    urgent: "true",
  });

  assert.equal(
    JSON.stringify(normalizeCeoDirectiveQuery(params)),
    JSON.stringify({
      departmentId: "영업본부_ID",
      limit: 100,
      page: 1,
      status: null,
      urgent: true,
    }),
  );
});

test("대표 지시사항 캐시 키는 부서와 필터를 모두 포함한다", () => {
  const { buildDepartmentDirectiveCacheKey } = loadTypeScriptModule("src/lib/constants/status-labels.ts");

  assert.equal(
    buildDepartmentDirectiveCacheKey({
      departmentId: "dept-1",
      limit: 50,
      page: 2,
      status: "DELAYED",
      urgent: false,
    }),
    "dept-1|DELAYED|false|2|50",
  );
});

test("대표 지시사항 API는 부서 배정 테이블에서 시작하고 삭제 지시를 제외한다", () => {
  const routeSource = fs.readFileSync(path.join(rootDir, "src/app/api/ceo/directives/route.ts"), "utf8");

  assert.match(routeSource, /\.from\("directive_departments"\)/);
  assert.match(routeSource, /\.eq\("directives\.is_deleted", false\)/);
  assert.doesNotMatch(routeSource, /directive_logs|directive_attachments|history/i);
});

test("대표 드릴다운 UI 파일에는 금지된 영어 노출 문구가 없다", () => {
  const files = [
    "src/components/ceo/DepartmentProgressCard.tsx",
    "src/components/ceo/DepartmentDirectivePanel.tsx",
    "src/components/ceo/DirectiveList.tsx",
    "src/components/ceo/DirectiveListSkeleton.tsx",
    "src/components/ceo/StatusFilterBar.tsx",
    "src/lib/hooks/useDepartmentDirectives.ts",
    "src/components/dashboard/ceo-dashboard-client.tsx",
    "src/app/dashboard/ceo/page.tsx",
    "src/components/app/app-frame.tsx",
    "src/components/app/app-header.tsx",
    "src/components/auth/brand-panel.tsx",
    "src/components/ui/loading-overlay.tsx",
    "src/app/loading.tsx",
  ];

  const combinedSource = files.map((file) => fs.readFileSync(path.join(rootDir, file), "utf8")).join("\n");

  for (const word of forbiddenVisibleWords) {
    assert.doesNotMatch(combinedSource, new RegExp(`>\\s*[^<>{\\n]*${word}[^<>{\\n]*\\s*<`));
    assert.doesNotMatch(
      combinedSource,
      new RegExp(`\\b(aria-label|title|placeholder)={[^}]*${word}[^}]*}`),
    );
    assert.doesNotMatch(
      combinedSource,
      new RegExp(`\\b(aria-label|title|placeholder)=["'][^"']*${word}[^"']*["']`),
    );
  }
});
