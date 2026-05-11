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

const expectedDepartmentSummary = [
  ["전 부서", 37, 29, 5, 3, 22],
  ["기획영업부", 36, 29, 4, 3, 19],
  ["경영관리센터", 38, 30, 8, 0, 21],
  ["구매물류부", 28, 23, 4, 1, 18],
  ["각 부서장", 2, 1, 1, 0, 50],
  ["각 리더", 2, 1, 0, 1, 50],
  ["공장총괄본부", 1, 1, 0, 0, 0],
];

test("260508 엑셀 기준 지시사항 seed는 127건과 누락 보정 항목을 포함한다", () => {
  const {
    CN_DIRECTIVE_260508_EXPECTED_SUMMARY,
    CN_DIRECTIVES_260508,
  } = loadTypeScriptModule("src/data/cn-directives-260508.ts");

  assert.equal(CN_DIRECTIVES_260508.length, 127);
  assert.equal(CN_DIRECTIVE_260508_EXPECTED_SUMMARY.totalCount, 127);
  assert.equal(CN_DIRECTIVE_260508_EXPECTED_SUMMARY.source.대표.totalCount, 45);
  assert.equal(CN_DIRECTIVE_260508_EXPECTED_SUMMARY.source.부사장.totalCount, 82);

  const coldStorageDirective = CN_DIRECTIVES_260508.find(
    (item) =>
      item.sourceLabel === "부사장" &&
      item.originalNo === 63 &&
      item.meetingDate === "2026-04-24" &&
      item.title.includes("기획영업부 사무실 냉동창고 공사"),
  );

  assert.ok(coldStorageDirective, "통합 시트에서 빠진 부사장 No.63 냉동창고 공사 건이 필요합니다.");
  assert.equal(JSON.stringify(coldStorageDirective.departments), JSON.stringify(["기획영업부", "경영관리센터"]));
});

test("260508 seed는 내부 workflow 상태와 대표 보고 버킷을 분리한다", () => {
  const { CN_DIRECTIVES_260508 } = loadTypeScriptModule("src/data/cn-directives-260508.ts");
  const allowedInternalStatuses = new Set([
    "NEW",
    "IN_PROGRESS",
    "COMPLETION_REQUESTED",
    "DELAYED",
    "COMPLETED",
    "REJECTED",
  ]);
  const forbiddenInternalStatuses = new Set(["지속", "CONTINUING", "ONGOING", "SUSTAINED"]);
  const internalStatusCounts = new Map();
  const reportBucketCounts = new Map();

  for (const item of CN_DIRECTIVES_260508) {
    assert.equal(allowedInternalStatuses.has(item.internalStatus), true);
    assert.equal(forbiddenInternalStatuses.has(item.internalStatus), false);
    internalStatusCounts.set(item.internalStatus, (internalStatusCounts.get(item.internalStatus) ?? 0) + 1);
    reportBucketCounts.set(item.reportBucket, (reportBucketCounts.get(item.reportBucket) ?? 0) + 1);
  }

  assert.equal(internalStatusCounts.get("IN_PROGRESS"), 107);
  assert.equal(internalStatusCounts.get("COMPLETED"), 20);
  assert.equal(reportBucketCounts.get("진행중"), 99);
  assert.equal(reportBucketCounts.get("완료"), 20);
  assert.equal(reportBucketCounts.get("지속"), 8);
});

test("대표 보고 집계는 전체·주관·부서별 검증값과 이행률 공식을 맞춘다", () => {
  const { CN_DIRECTIVES_260508 } = loadTypeScriptModule("src/data/cn-directives-260508.ts");
  const {
    buildCeoReportSummary,
    calculateCeoReportCompletionRate,
  } = loadTypeScriptModule("src/features/dashboard/ceo-report.ts");

  const report = buildCeoReportSummary(CN_DIRECTIVES_260508);

  assert.equal(report.total.totalCount, 127);
  assert.equal(report.total.inProgressCount, 99);
  assert.equal(report.total.completedCount, 20);
  assert.equal(report.total.continuingCount, 8);
  assert.equal(report.total.completionRate, 22);

  assert.equal(JSON.stringify(
    report.sourceSummary.map((item) => [
      item.sourceLabel,
      item.totalCount,
      item.inProgressCount,
      item.completedCount,
      item.continuingCount,
      item.completionRate,
    ])),
    JSON.stringify(
    [
      ["대표 지시사항", 45, 35, 7, 3, 22],
      ["부사장 지시사항", 82, 64, 13, 5, 22],
    ]),
  );

  assert.equal(JSON.stringify(
    report.departmentSummary.map((item) => [
      item.departmentName,
      item.totalCount,
      item.inProgressCount,
      item.completedCount,
      item.continuingCount,
      item.completionRate,
    ])),
    JSON.stringify(expectedDepartmentSummary),
  );

  for (const [, totalCount, , completedCount, continuingCount, completionRate] of expectedDepartmentSummary) {
    assert.equal(calculateCeoReportCompletionRate(completedCount, continuingCount, totalCount), completionRate);
  }
});

test("대표 보고 요약은 드릴다운용 지시사항 item 데이터를 포함한다", () => {
  const { CN_DIRECTIVES_260508 } = loadTypeScriptModule("src/data/cn-directives-260508.ts");
  const { buildCeoReportSummary } = loadTypeScriptModule("src/features/dashboard/ceo-report.ts");

  const report = buildCeoReportSummary(CN_DIRECTIVES_260508);
  const firstItem = report.items[0];

  assert.equal(report.items.length, report.total.totalCount);
  assert.ok(firstItem.id);
  assert.ok(firstItem.directiveNo);
  assert.ok(firstItem.title);
  assert.equal(firstItem.href, `/directives/${firstItem.id}`);
  assert.ok(["진행중", "완료", "지속"].includes(firstItem.reportBucket));
  assert.ok(["대표 지시사항", "부사장 지시사항"].includes(firstItem.sourceLabel));
  assert.equal(Array.isArray(firstItem.departmentNames), true);
  assert.ok(firstItem.departmentNames.length > 0);
  assert.ok(firstItem.status);
  assert.ok(firstItem.statusLabel);
  assert.equal("dueDate" in firstItem, true);
});

test("대표 보고 드릴다운 필터는 보고 버킷별 지시사항을 정확히 고른다", () => {
  const { CN_DIRECTIVES_260508 } = loadTypeScriptModule("src/data/cn-directives-260508.ts");
  const {
    buildCeoReportSummary,
    filterCeoReportDirectiveItems,
  } = loadTypeScriptModule("src/features/dashboard/ceo-report.ts");

  const report = buildCeoReportSummary(CN_DIRECTIVES_260508);

  assert.equal(
    filterCeoReportDirectiveItems(report.items, { title: "진행 중", bucket: "진행중" }).length,
    report.total.inProgressCount,
  );
  assert.equal(
    filterCeoReportDirectiveItems(report.items, { title: "완료", bucket: "완료" }).length,
    report.total.completedCount,
  );
  assert.equal(
    filterCeoReportDirectiveItems(report.items, { title: "지속", bucket: "지속" }).length,
    report.total.continuingCount,
  );
});

test("대표 보고 드릴다운 필터는 각 부서장·각 리더·전 부서를 섞지 않는다", () => {
  const { CN_DIRECTIVES_260508 } = loadTypeScriptModule("src/data/cn-directives-260508.ts");
  const {
    buildCeoReportSummary,
    filterCeoReportDirectiveItems,
  } = loadTypeScriptModule("src/features/dashboard/ceo-report.ts");

  const report = buildCeoReportSummary(CN_DIRECTIVES_260508);
  const byDepartment = new Map(report.departmentSummary.map((item) => [item.departmentName, item]));

  for (const departmentName of ["각 부서장", "각 리더", "전 부서"]) {
    const filteredItems = filterCeoReportDirectiveItems(report.items, { title: departmentName, departmentName });
    assert.equal(filteredItems.length, byDepartment.get(departmentName)?.totalCount);
    assert.equal(
      filteredItems.every((item) => item.departmentNames.includes(departmentName)),
      true,
    );
  }

  assert.equal(
    filterCeoReportDirectiveItems(report.items, { title: "각 부서장", departmentName: "각 부서장" }).some((item) =>
      item.departmentNames.includes("전 부서"),
    ),
    false,
  );
  assert.equal(
    filterCeoReportDirectiveItems(report.items, { title: "각 리더", departmentName: "각 리더" }).some((item) =>
      item.departmentNames.includes("전 부서"),
    ),
    false,
  );
});

test("대표 보고 드릴다운 필터는 주관별/복합 조건 수치를 표시 집계와 맞춘다", () => {
  const { CN_DIRECTIVES_260508 } = loadTypeScriptModule("src/data/cn-directives-260508.ts");
  const {
    buildCeoReportSummary,
    filterCeoReportDirectiveItems,
  } = loadTypeScriptModule("src/features/dashboard/ceo-report.ts");

  const report = buildCeoReportSummary(CN_DIRECTIVES_260508);

  for (const source of report.sourceSummary) {
    assert.equal(
      filterCeoReportDirectiveItems(report.items, { title: source.sourceLabel, sourceLabel: source.sourceLabel }).length,
      source.totalCount,
    );
    assert.equal(
      filterCeoReportDirectiveItems(report.items, {
        title: `${source.sourceLabel} 진행중`,
        sourceLabel: source.sourceLabel,
        bucket: "진행중",
      }).length,
      source.inProgressCount,
    );
    assert.equal(
      filterCeoReportDirectiveItems(report.items, {
        title: `${source.sourceLabel} 완료+지속`,
        sourceLabel: source.sourceLabel,
        buckets: ["완료", "지속"],
      }).length,
      source.completedCount + source.continuingCount,
    );
  }

  for (const department of report.departmentSummary) {
    assert.equal(
      filterCeoReportDirectiveItems(report.items, {
        title: `${department.departmentName} 진행중`,
        departmentName: department.departmentName,
        bucket: "진행중",
      }).length,
      department.inProgressCount,
    );
    assert.equal(
      filterCeoReportDirectiveItems(report.items, {
        title: `${department.departmentName} 완료`,
        departmentName: department.departmentName,
        bucket: "완료",
      }).length,
      department.completedCount,
    );
    assert.equal(
      filterCeoReportDirectiveItems(report.items, {
        title: `${department.departmentName} 완료+지속`,
        departmentName: department.departmentName,
        buckets: ["완료", "지속"],
      }).length,
      department.completedCount + department.continuingCount,
    );
  }
});

test("대표 보고 집계는 원본 담당부서 라벨을 실행 부서 정규화보다 우선한다", () => {
  const { buildCeoReportSummary } = loadTypeScriptModule("src/features/dashboard/ceo-report.ts");
  const report = buildCeoReportSummary([
    {
      content: [
        "테스트 지시 1",
        "원본상태: 완료",
        "보고상태: 완료",
        "원본담당부서: 각 부서장",
        "보고담당부서: 전체",
        "주관: 대표",
      ].join("\n"),
      status: "COMPLETED",
    },
    {
      content: [
        "테스트 지시 2",
        "원본상태: 지속",
        "보고상태: 지속",
        "원본담당부서: 각 리더",
        "보고담당부서: 전체",
        "주관: 대표",
      ].join("\n"),
      status: "IN_PROGRESS",
    },
    {
      content: [
        "테스트 지시 3",
        "원본상태: 진행중",
        "보고상태: 진행중",
        "원본담당부서: 전체",
        "주관: 대표",
      ].join("\n"),
      status: "IN_PROGRESS",
    },
    {
      content: [
        "테스트 지시 4",
        "원본상태: 완료",
        "보고상태: 완료",
        "원본담당부서: HACCP",
        "주관: 부사장",
      ].join("\n"),
      status: "COMPLETED",
    },
  ]);

  const byDepartment = new Map(report.departmentSummary.map((item) => [item.departmentName, item]));

  assert.equal(byDepartment.get("각 부서장")?.totalCount, 1);
  assert.equal(byDepartment.get("각 부서장")?.completedCount, 1);
  assert.equal(byDepartment.get("각 리더")?.totalCount, 1);
  assert.equal(byDepartment.get("각 리더")?.continuingCount, 1);
  assert.equal(byDepartment.get("전 부서")?.totalCount, 1);
  assert.equal(byDepartment.get("전 부서")?.inProgressCount, 1);
  assert.equal(byDepartment.get("경영관리센터")?.totalCount, 1);
  assert.equal(byDepartment.get("경영관리센터")?.completedCount, 1);
});

test("HACCP은 대표 보고와 교체 import에서 경영관리센터로 정규화한다", () => {
  const { CN_DIRECTIVES_260508 } = loadTypeScriptModule("src/data/cn-directives-260508.ts");
  const service = read("src/features/bulk-directives/service.ts");
  const migration = read("supabase/migrations/202605100001_import_cn_directives_260508_127.sql");

  const haccpDirective = CN_DIRECTIVES_260508.find((item) => item.originalDepartmentText === "구매물류부, HACCP");

  assert.ok(haccpDirective);
  assert.equal(JSON.stringify(haccpDirective.departments), JSON.stringify(["구매물류부", "경영관리센터"]));
  assert.match(service, /HACCP["'],\s*["']경영관리센터/);
  assert.doesNotMatch(service, /HACCP["'],\s*["']공장총괄본부/);
  assert.match(migration, /'HACCP', '경영관리센터'/);
  assert.match(migration, /'구매물류부, HACCP', '구매물류부, 경영관리센터'/);
});

test("260508 DB import migration은 soft-archive와 보고 메타데이터 검증을 제공한다", () => {
  const migration = read("supabase/migrations/202605100001_import_cn_directives_260508_127.sql");
  const validation = read("supabase/scripts/cn_directives_260508_validation.sql");

  assert.match(migration, /CN_260508_DIRECTIVE_REPLACE_127/);
  assert.match(migration, /expected 127 directives/);
  assert.match(migration, /directive_no = 'OLD-' \|\| d\.directive_no/);
  assert.match(migration, /is_archived = true/);
  assert.doesNotMatch(migration, /\.delete\(/);
  assert.doesNotMatch(migration, /target_scope\s*=\s*'ALL'/);
  assert.match(migration, /'SELECTED'::text as target_scope/);
  assert.match(migration, /보고상태/);
  assert.match(migration, /보고담당부서/);
  assert.match(migration, /기한\/비고/);
  assert.match(migration, /status_en in \('CONTINUING', 'ONGOING', 'SUSTAINED', '지속'\)/);
  assert.match(migration, /source_no = 63/);
  assert.match(migration, /기획영업부 사무실 냉동창고 공사/);
  assert.match(migration, /'전 부서', '전체'/);
  assert.match(migration, /v_expected_assignment_count int := 144/);
  assert.match(migration, /do \$\$/);
  assert.doesNotMatch(migration, /^begin;$/m);
  assert.doesNotMatch(migration, /^commit;$/m);
  assert.doesNotMatch(migration, /on commit drop/i);
  assert.match(migration, /on commit preserve rows/i);
  assert.match(migration, /least\(coalesce\(min\(sequence\), -100000\), -100000\)/);
  assert.match(migration, /partition by archived\.year_month/);

  assert.match(validation, /expected_directives_count/);
  assert.match(validation, /99 as expected_in_progress_count/);
  assert.match(validation, /20 as expected_completed_count/);
  assert.match(validation, /8 as expected_continuing_count/);
  assert.match(validation, /보고담당부서/);
});

test("대표 대시보드는 팀장 보고형 요약 패널을 데이터 기반으로 렌더링한다", () => {
  const dashboardSource = read("src/components/dashboard/ceo-dashboard-client.tsx");
  const ceoReportSource = read("src/features/dashboard/ceo-report.ts");
  const typesSource = read("src/features/dashboard/types.ts");
  const serviceSource = read("src/features/dashboard/service.ts");
  const combinedSource = `${dashboardSource}\n${ceoReportSource}`;

  assert.match(typesSource, /ceoReport: CeoReportSummary/);
  assert.match(serviceSource, /buildCeoReportSummary/);
  assert.match(combinedSource, /지시사항 이행 현황 보고/);
  assert.match(combinedSource, /주간 관리자 회의/);
  assert.match(combinedSource, /2026\. 5\. 8\./);
  assert.match(dashboardSource, /총 지시사항/);
  assert.match(dashboardSource, /진행 중/);
  assert.match(dashboardSource, /완료/);
  assert.match(dashboardSource, /지속/);
  assert.match(dashboardSource, /담당 부서/);
  assert.match(dashboardSource, /이행률 = \(완료 \+ 지속\) \/ 총 건수/);
  assert.match(dashboardSource, /Array\.from\(\{ length: 10 \}/);
  assert.match(dashboardSource, /Math\.round\(rate \/ 10\)/);
  assert.match(dashboardSource, /onOpenDrilldown/);
  assert.match(dashboardSource, /CeoReportDirectiveDrilldown/);
  assert.match(dashboardSource, /filterCeoReportDirectiveItems/);
  assert.match(dashboardSource, /type="button"/);
  assert.match(dashboardSource, /해당 조건의 지시사항이 없습니다/);
  assert.match(dashboardSource, /href=\{item\.href\}/);
  assert.match(dashboardSource, /md:hidden/);
  assert.match(dashboardSource, /hidden overflow-hidden md:block/);
});
