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
      scope: "department",
      status: null,
      urgent: true,
    }),
  );

  const globalParams = new URLSearchParams({
    scope: "global",
    status: "DELAYED",
  });

  assert.equal(
    JSON.stringify(normalizeCeoDirectiveQuery(globalParams)),
    JSON.stringify({
      departmentId: null,
      limit: 50,
      page: 1,
      scope: "global",
      status: "DELAYED",
      urgent: false,
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
      scope: "department",
      status: "DELAYED",
      urgent: false,
    }),
    "department|dept-1|DELAYED|false|2|50",
  );

  assert.equal(
    buildDepartmentDirectiveCacheKey({
      departmentId: null,
      limit: 50,
      page: 1,
      scope: "global",
      status: null,
      urgent: true,
    }),
    "global|ALL|ALL|true|1|50",
  );
});

test("대표 지시사항 API는 부서 배정 테이블에서 시작하고 삭제 지시를 제외한다", () => {
  const routeSource = fs.readFileSync(path.join(rootDir, "src/app/api/ceo/directives/route.ts"), "utf8");

  assert.match(routeSource, /\.from\("directive_departments"\)/);
  assert.match(routeSource, /\.eq\("directives\.is_archived", false\)/);
  assert.match(routeSource, /buildFallbackResponse/);
  assert.match(routeSource, /listDirectivesForSession/);
  assert.match(routeSource, /query\.scope === "global"/);
  assert.match(routeSource, /matchesDirectiveStatus/);
  assert.match(routeSource, /\["NEW", "IN_PROGRESS"\]/);
  assert.match(routeSource, /item\.isDelayed/);
  assert.match(routeSource, /item\.isUrgent/);
  assert.doesNotMatch(routeSource, /directives\.is_deleted/);
  assert.doesNotMatch(routeSource, /\.eq\("directives\.status"/);
  assert.doesNotMatch(routeSource, /directive_logs|directive_attachments|history/i);
});

test("대표 드릴다운은 검색 파라미터 변경으로 전체 화면을 다시 띄우지 않는다", () => {
  const dashboardSource = fs.readFileSync(
    path.join(rootDir, "src/components/dashboard/ceo-dashboard-client.tsx"),
    "utf8",
  );

  assert.match(dashboardSource, /detailPanelRef/);
  assert.match(dashboardSource, /shouldShowPanel/);
  assert.match(dashboardSource, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(430px,560px\)\]/);
  assert.match(dashboardSource, /lg:sticky/);
  assert.match(dashboardSource, /lg:top-5/);
  assert.match(dashboardSource, /window\.history\.replaceState\(null, "", nextUrl\)/);
  assert.match(dashboardSource, /window\.addEventListener\("popstate"/);
  assert.match(dashboardSource, /max-width: 1023px/);
  assert.match(dashboardSource, /scrollDetailPanelIntoView/);
  assert.match(dashboardSource, /isDetailPanelOutsideComfortZone/);
  assert.match(dashboardSource, /block: "nearest"/);
  assert.match(dashboardSource, /window\.innerHeight - panelMinimumVisibleHeight/);
  assert.match(dashboardSource, /type SelectedScope = "none" \| "global" \| "department"/);
  assert.doesNotMatch(dashboardSource, /router\.replace/);
  assert.doesNotMatch(dashboardSource, /router\.push/);

  const cardMapIndex = dashboardSource.indexOf("data.departments.map");
  const asideIndex = dashboardSource.indexOf("<aside");
  assert.ok(cardMapIndex > -1, "부서 카드 목록 렌더링이 필요합니다.");
  assert.ok(asideIndex > -1, "우측 확인창 aside 렌더링이 필요합니다.");
  assert.ok(asideIndex > cardMapIndex, "우측 확인창은 부서 카드 map 내부가 아니라 별도 컬럼에 있어야 합니다.");
});

test("상단 KPI 카드는 전체 상태 리스트를 여는 선택 함수와 필터 매핑을 가진다", () => {
  const dashboardSource = fs.readFileSync(
    path.join(rootDir, "src/components/dashboard/ceo-dashboard-client.tsx"),
    "utf8",
  );

  assert.match(dashboardSource, /selectGlobalStatus/);
  assert.match(dashboardSource, /prefetchGlobalStatus/);
  assert.match(dashboardSource, /label: "전체 지시 건수"[\s\S]*status: null[\s\S]*urgent: false/);
  assert.match(dashboardSource, /label: "진행중"[\s\S]*status: "IN_PROGRESS"/);
  assert.match(dashboardSource, /label: "승인 대기"[\s\S]*status: "COMPLETION_REQUESTED"/);
  assert.match(dashboardSource, /label: "지연"[\s\S]*status: "DELAYED"/);
  assert.match(dashboardSource, /label: "긴급"[\s\S]*urgent: true/);
  assert.match(dashboardSource, /label: "완료율"[\s\S]*status: "COMPLETED"/);
  assert.match(dashboardSource, /aria-label=\{card\.ariaLabel\}/);
  assert.match(dashboardSource, /선택됨/);
});

test("부서 카드의 큰 상태 박스도 각각 상태별 조회 버튼으로 동작한다", () => {
  const cardSource = fs.readFileSync(
    path.join(rootDir, "src/components/ceo/DepartmentProgressCard.tsx"),
    "utf8",
  );

  assert.match(cardSource, /<button/);
  assert.match(cardSource, /IN_PROGRESS/);
  assert.match(cardSource, /COMPLETED/);
  assert.match(cardSource, /REJECTED/);
  assert.match(cardSource, /COMPLETION_REQUESTED/);
  assert.match(cardSource, /DELAYED/);
  assert.match(cardSource, /handleStatusClick\(event, null, true\)/);
  assert.match(cardSource, /event\.stopPropagation\(\)/);
  assert.match(cardSource, /aria-label=\{`\$\{department\.departmentName\} \$\{metric\.label\} 지시사항 보기`\}/);
});

test("우측 확인창은 전체 보기와 부서 보기에 맞는 한국어 제목과 부제를 사용한다", () => {
  const panelSource = fs.readFileSync(path.join(rootDir, "src/components/ceo/DepartmentDirectivePanel.tsx"), "utf8");

  assert.match(panelSource, /mode: "global" \| "department"/);
  assert.match(panelSource, /전체 지시사항/);
  assert.match(panelSource, /전체 진행중 지시사항/);
  assert.match(panelSource, /전체 승인 대기 지시사항/);
  assert.match(panelSource, /전체 지연 지시사항/);
  assert.match(panelSource, /전체 긴급 지시사항/);
  assert.match(panelSource, /해당 부서의 전체 지시사항을 표시하고 있습니다/);
  assert.match(panelSource, /전체 진행중 지시사항을 표시하고 있습니다/);
});

test("부서 지시사항 로딩은 최소 표시 시간과 한국어 문구를 사용한다", () => {
  const hookSource = fs.readFileSync(path.join(rootDir, "src/lib/hooks/useDepartmentDirectives.ts"), "utf8");
  const panelSource = fs.readFileSync(path.join(rootDir, "src/components/ceo/DepartmentDirectivePanel.tsx"), "utf8");
  const skeletonSource = fs.readFileSync(path.join(rootDir, "src/components/ceo/DirectiveListSkeleton.tsx"), "utf8");
  const ceoLoadingSource = fs.readFileSync(path.join(rootDir, "src/app/dashboard/ceo/loading.tsx"), "utf8");

  assert.match(hookSource, /MIN_VISIBLE_LOADING_MS\s*=\s*420/);
  assert.match(hookSource, /AbortController/);
  assert.match(hookSource, /cache:\s*"no-store"/);
  assert.match(panelSource, /지시사항을 불러오는 중입니다/);
  assert.match(panelSource, /화면은 그대로 유지됩니다/);
  assert.match(panelSource, /cn-loading-ring/);
  assert.match(panelSource, /loading-bar/);
  assert.match(skeletonSource, /executive-skeleton/);
  assert.match(ceoLoadingSource, /대표 대시보드를 준비하고 있습니다/);
  assert.match(ceoLoadingSource, /지시 현황을 불러오는 중입니다/);
});

test("부서 지시사항 마이그레이션은 보존 필터 기준 인덱스만 포함한다", () => {
  const migrationSource = fs.readFileSync(
    path.join(rootDir, "supabase/migrations/202604280001_ceo_dashboard_drilldown_indexes.sql"),
    "utf8",
  );

  assert.match(migrationSource, /idx_directive_departments_department_status_created/);
  assert.match(migrationSource, /department_status/);
  assert.match(migrationSource, /idx_directives_archived_created/);
  assert.match(migrationSource, /idx_directives_urgent_archived_created/);
  assert.doesNotMatch(migrationSource, /is_deleted/);
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
    "src/app/dashboard/ceo/loading.tsx",
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
