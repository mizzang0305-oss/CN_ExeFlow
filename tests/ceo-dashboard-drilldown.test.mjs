import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

import ts from "typescript";

const rootDir = process.cwd();
const require = createRequire(import.meta.url);

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

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

  assert.equal(DIRECTIVE_STATUS_LABELS.NEW, "대기");
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
    assert.equal(visibleLabels.includes(word), false, `${word} 문구가 노출되면 안 됩니다.`);
  }
});

test("대표 대시보드는 이행 점수와 부서별 그래프를 제공한다", () => {
  const dashboardSource = read("src/components/dashboard/ceo-dashboard-client.tsx");
  const serviceSource = read("src/features/dashboard/service.ts");
  const typesSource = read("src/features/dashboard/types.ts");
  const cardSource = read("src/components/ceo/DepartmentProgressCard.tsx");

  assert.match(typesSource, /executionScore/);
  assert.match(typesSource, /executionGrade/);
  assert.match(typesSource, /waitingApprovalStaleCount/);
  assert.match(serviceSource, /calculateExecutionScore/);
  assert.match(serviceSource, /delayedCount \* 8/);
  assert.match(serviceSource, /urgentCount \* 10/);
  assert.match(serviceSource, /waitingApprovalStaleCount \* 4/);
  assert.match(serviceSource, /score >= 90/);
  assert.match(serviceSource, /score >= 75/);
  assert.match(serviceSource, /score >= 60/);
  assert.match(dashboardSource, /부서 이행 순위/);
  assert.match(dashboardSource, /이행 점수/);
  assert.match(dashboardSource, /부서별 완료율/);
  assert.match(dashboardSource, /부서별 지연 현황/);
  assert.match(dashboardSource, /긴급 처리 현황/);
  assert.match(cardSource, /department\.executionScore/);
  assert.match(cardSource, /department\.executionGrade/);
});

test("대표 대시보드는 오늘 확인할 실행 리스크에서 기존 우측 확인창 필터를 연다", () => {
  const dashboardSource = read("src/components/dashboard/ceo-dashboard-client.tsx");

  assert.match(dashboardSource, /오늘 확인할 실행 리스크/);
  assert.match(dashboardSource, /지연 \$\{department\.delayedCount\}건/);
  assert.match(dashboardSource, /긴급 \$\{department\.urgentCount\}건/);
  assert.match(dashboardSource, /승인 대기 \$\{department\.waitingApprovalCount\}건/);
  assert.match(dashboardSource, /부서 보기/);
  assert.match(dashboardSource, /지연 보기/);
  assert.match(dashboardSource, /긴급 보기/);
  assert.match(dashboardSource, /onStatusSelect\(department\.departmentId, "DELAYED", false\)/);
  assert.match(dashboardSource, /onStatusSelect\(department\.departmentId, null, true\)/);
  assert.match(dashboardSource, /selectDepartmentStatus/);
  assert.match(dashboardSource, /selectGlobalStatus/);
});

test("대표 대시보드 분석 카드는 넘침 없이 요약과 상세 모달로 분리한다", () => {
  const dashboardSource = read("src/components/dashboard/ceo-dashboard-client.tsx");

  assert.doesNotMatch(dashboardSource, /writing-mode/);
  assert.match(dashboardSource, /min-w-0/);
  assert.match(dashboardSource, /overflow-hidden/);
  assert.match(dashboardSource, /break-words/);
  assert.match(dashboardSource, /whitespace-normal/);
  assert.match(dashboardSource, /line-clamp-2/);
  assert.match(dashboardSource, /자세히 보기/);
  assert.match(dashboardSource, /부서 이행 순위 상세/);
  assert.match(dashboardSource, /부서별 완료율 상세/);
  assert.match(dashboardSource, /긴급 처리 현황 상세/);
  assert.match(dashboardSource, /오늘 확인할 실행 리스크 상세/);
  assert.match(dashboardSource, /위험 상세 보기/);
  assert.match(dashboardSource, /role="dialog"/);
  assert.match(dashboardSource, /aria-modal="true"/);

  const rankingCardSource = dashboardSource.slice(
    dashboardSource.indexOf("function DepartmentExecutionRanking"),
    dashboardSource.indexOf("function RiskSignalPanel"),
  );
  const riskCardSource = dashboardSource.slice(
    dashboardSource.indexOf("function RiskSignalPanel"),
    dashboardSource.indexOf("function DepartmentActionButtons"),
  );

  assert.doesNotMatch(rankingCardSource, /<table/);
  assert.doesNotMatch(riskCardSource, /xl:grid-cols-2/);
});

test("분석 상세 모달 버튼은 우측 확인창을 열고 모달을 닫는다", () => {
  const dashboardSource = read("src/components/dashboard/ceo-dashboard-client.tsx");

  assert.match(dashboardSource, /부서 보기/);
  assert.match(dashboardSource, /지연 보기/);
  assert.match(dashboardSource, /긴급 보기/);
  assert.match(dashboardSource, /setOpenAnalysisModal\(null\)/);
  assert.match(dashboardSource, /onDepartmentSelect\(department\.departmentId\)/);
  assert.match(dashboardSource, /onStatusSelect\(department\.departmentId, "DELAYED", false\)/);
  assert.match(dashboardSource, /onStatusSelect\(department\.departmentId, null, true\)/);
  assert.match(dashboardSource, /min-h-11/);
  assert.match(dashboardSource, /focus-visible:outline/);
});

test("부서장 실행보드는 자기 부서 요약을 큰 글자와 단순 문구로 보여준다", () => {
  const boardSource = read("src/app/board/page.tsx");
  const dashboardServiceSource = read("src/features/dashboard/service.ts");

  assert.match(boardSource, /부서장 요약/);
  assert.match(boardSource, /오늘 처리할 지시/);
  assert.match(boardSource, /내 부서 전체 지시/);
  assert.match(boardSource, /대기/);
  assert.match(boardSource, /진행중/);
  assert.match(boardSource, /지연 주의/);
  assert.match(boardSource, /긴급/);
  assert.match(boardSource, /완료 요청/);
  assert.match(boardSource, /오늘 입력해야 할 행동 로그/);
  assert.match(boardSource, /증빙 필요/);
  assert.match(boardSource, /text-4xl/);
  assert.match(dashboardServiceSource, /session\.role === "DEPARTMENT_HEAD" && session\.departmentId !== departmentId/);
  assert.match(dashboardServiceSource, /본인 부서/);
});

test("대표 지시사항 쿼리는 잘못된 상태를 전체로 돌리고 제한을 적용한다", () => {
  const { normalizeCeoDirectiveQuery } = loadTypeScriptModule("src/lib/constants/status-labels.ts");
  const params = new URLSearchParams({
    departmentId: "영업본부_ID",
    limit: "500",
    page: "0",
    status: "UNKNOWN",
    urgent: "true",
  });

  assert.equal(JSON.stringify(normalizeCeoDirectiveQuery(params)), JSON.stringify({
    departmentId: "영업본부_ID",
    limit: 100,
    page: 1,
    scope: "department",
    status: null,
    urgent: true,
  }));

  const globalParams = new URLSearchParams({
    scope: "global",
    status: "DELAYED",
  });

  assert.equal(JSON.stringify(normalizeCeoDirectiveQuery(globalParams)), JSON.stringify({
    departmentId: null,
    limit: 50,
    page: 1,
    scope: "global",
    status: "DELAYED",
    urgent: false,
  }));
});

test("대표 지시사항 캐시 키는 조회 범위와 필터를 모두 포함한다", () => {
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

test("대표 지시사항 API는 부서 배정 테이블과 fallback을 사용한다", () => {
  const routeSource = read("src/app/api/ceo/directives/route.ts");

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

test("대표 대시보드는 검색 파라미터 변경으로 전체 화면을 다시 띄우지 않는다", () => {
  const dashboardSource = read("src/components/dashboard/ceo-dashboard-client.tsx");
  const pageSource = read("src/app/dashboard/ceo/page.tsx");

  assert.match(dashboardSource, /detailPanelRef/);
  assert.match(dashboardSource, /shouldShowPanel/);
  assert.match(dashboardSource, /xl:fixed/);
  assert.match(dashboardSource, /xl:right-6/);
  assert.match(dashboardSource, /xl:top-6/);
  assert.match(dashboardSource, /xl:bottom-6/);
  assert.match(dashboardSource, /xl:w-\[600px\]/);
  assert.match(dashboardSource, /2xl:w-\[640px\]/);
  assert.match(dashboardSource, /aria-label="지시사항 확인창"/);
  assert.match(dashboardSource, /xl:pr-\[640px\]/);
  assert.match(dashboardSource, /2xl:pr-\[680px\]/);
  assert.match(dashboardSource, /max-width: 1279px/);
  assert.match(dashboardSource, /window\.history\.replaceState\(null, "", nextUrl\)/);
  assert.match(dashboardSource, /window\.addEventListener\("popstate"/);
  assert.match(dashboardSource, /detailPanelRef\.current\?\.scrollIntoView\(\{\s*behavior: "smooth",\s*block: "start"/);
  assert.doesNotMatch(dashboardSource, /lg:fixed/);
  assert.doesNotMatch(dashboardSource, /lg:sticky/);
  assert.doesNotMatch(dashboardSource, /router\.replace/);
  assert.doesNotMatch(dashboardSource, /router\.push/);
  assert.match(pageSource, /세션이 유효하지 않습니다/);
  assert.match(pageSource, /!session\?\.userId/);

  const cardMapIndex = dashboardSource.indexOf("data.departments.map");
  const asideIndex = dashboardSource.indexOf("<aside");
  assert.ok(cardMapIndex > -1, "부서 카드 목록 렌더링이 필요합니다.");
  assert.ok(asideIndex > -1, "우측 확인창 aside 렌더링이 필요합니다.");
  assert.ok(asideIndex > cardMapIndex, "우측 확인창은 부서 카드 map 바깥에 있어야 합니다.");
});

test("상단 KPI 카드는 전체 상태 리스트를 여는 매핑을 가진다", () => {
  const dashboardSource = read("src/components/dashboard/ceo-dashboard-client.tsx");

  assert.match(dashboardSource, /selectGlobalStatus/);
  assert.match(dashboardSource, /closeInspectorPanel/);
  assert.match(dashboardSource, /prefetchGlobalStatus/);
  assert.match(dashboardSource, /label: "전체 지시 건수"[\s\S]*status: null[\s\S]*urgent: false/);
  assert.match(dashboardSource, /label: "대기"[\s\S]*status: "NEW"/);
  assert.match(dashboardSource, /selectGlobalStatus\("NEW", false\)/);
  assert.match(dashboardSource, /label: "진행중"[\s\S]*status: "IN_PROGRESS"/);
  assert.match(dashboardSource, /label: "승인 대기"[\s\S]*status: "COMPLETION_REQUESTED"/);
  assert.match(dashboardSource, /selectGlobalStatus\("COMPLETION_REQUESTED", false\)/);
  assert.match(dashboardSource, /label: "지연"[\s\S]*status: "DELAYED"/);
  assert.match(dashboardSource, /label: "긴급"[\s\S]*urgent: true/);
  assert.match(dashboardSource, /selectGlobalStatus\(null, true\)/);
  assert.match(dashboardSource, /label: "완료율"[\s\S]*status: "COMPLETED"/);
  assert.match(dashboardSource, /aria-label=\{card\.ariaLabel\}/);
  assert.match(dashboardSource, /선택됨/);
  assert.match(dashboardSource, /xl:grid-cols-7/);
});

test("부서 카드의 상태 박스는 각각 상태별 조회 버튼으로 동작한다", () => {
  const cardSource = read("src/components/ceo/DepartmentProgressCard.tsx");

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

test("우측 확인창은 전체 보기와 부서 보기에 맞는 한국어 제목과 compact 리스트를 제공한다", () => {
  const panelSource = read("src/components/ceo/DepartmentDirectivePanel.tsx");
  const listSource = read("src/components/ceo/DirectiveList.tsx");

  assert.match(panelSource, /mode: "global" \| "department"/);
  assert.match(panelSource, /onClose: \(\) => void/);
  assert.match(panelSource, />\s*닫기\s*</);
  assert.match(panelSource, /전체 지시사항/);
  assert.match(panelSource, /전체 진행중 지시사항/);
  assert.match(panelSource, /전체 승인 대기 지시사항/);
  assert.match(panelSource, /전체 지연 지시사항/);
  assert.match(panelSource, /전체 긴급 지시사항/);
  assert.match(panelSource, /해당 부서의 전체 지시사항을 표시하고 있습니다/);
  assert.match(panelSource, /최신순/);
  assert.match(panelSource, /오래된순/);
  assert.match(listSource, /directive-row/);
  assert.match(listSource, /directive-main/);
  assert.match(listSource, /directive-title-line/);
  assert.match(listSource, /directive-meta-line/);
  assert.match(listSource, /directive-actions/);
  assert.match(listSource, /department_name/);
  assert.match(listSource, /dateLabel/);
  assert.match(listSource, /urgencyLabel/);
  assert.match(listSource, /item\.directive_no/);
  assert.match(listSource, /line-clamp-2/);
  assert.match(listSource, /text-lg/);
  assert.match(listSource, /font-semibold/);
  assert.match(listSource, /min-h-\[5\.75rem\]/);
  assert.match(listSource, /overflow-hidden/);
  assert.match(listSource, /min-w-0/);
  assert.match(listSource, /break-words/);
  assert.match(listSource, /whitespace-normal/);
  assert.doesNotMatch(listSource, /md:grid-cols-\[6\.5rem_4rem_minmax\(0,1fr\)_4\.75rem_5\.5rem_3\.75rem_4\.25rem\]/);
  assert.doesNotMatch(listSource, /<article\b/);

  const titleIndex = listSource.indexOf("{item.title}");
  const directiveNoIndex = listSource.indexOf("{item.directive_no}");
  assert.ok(titleIndex > -1, "지시 제목이 렌더링되어야 합니다.");
  assert.ok(directiveNoIndex > -1, "관리번호가 보조 정보로 렌더링되어야 합니다.");
  assert.ok(titleIndex < directiveNoIndex, "지시 제목이 관리번호보다 먼저 보여야 합니다.");
});

test("부서 지시사항 로딩은 최소 표시 시간과 한국어 문구를 사용한다", () => {
  const hookSource = read("src/lib/hooks/useDepartmentDirectives.ts");
  const panelSource = read("src/components/ceo/DepartmentDirectivePanel.tsx");
  const skeletonSource = read("src/components/ceo/DirectiveListSkeleton.tsx");
  const ceoLoadingSource = read("src/app/dashboard/ceo/loading.tsx");

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

test("부서 지시사항 마이그레이션은 현재 스키마 기준 인덱스만 포함한다", () => {
  const migrationSource = read("supabase/migrations/202604280001_ceo_dashboard_drilldown_indexes.sql");

  assert.match(migrationSource, /idx_directive_departments_department_status_created/);
  assert.match(migrationSource, /department_status/);
  assert.match(migrationSource, /idx_directives_archived_created/);
  assert.match(migrationSource, /idx_directives_urgent_archived_created/);
  assert.doesNotMatch(migrationSource, /is_deleted/);
});

test("대표 드릴다운 UI 파일에는 금지된 사용자 노출 영어 문구가 없다", () => {
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
    "src/components/ui/loading-overlay.tsx",
    "src/app/loading.tsx",
    "src/app/dashboard/ceo/loading.tsx",
  ];

  const combinedSource = files.map(read).join("\n");

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
