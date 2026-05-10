import { inflateRawSync } from "node:zlib";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppSession } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import type { DirectiveStatus, DirectiveUrgentLevel } from "@/features/directives";
import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";

import {
  BULK_DIRECTIVE_ALLOWED_DEPARTMENTS,
  BULK_DIRECTIVE_REPLACE_NOTE_COLUMNS,
  BULK_DIRECTIVE_REQUIRED_COLUMNS,
  BULK_DIRECTIVE_REPLACE_REQUIRED_COLUMNS,
  BULK_DIRECTIVE_STATUS_LABEL_TO_VALUE,
  BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL,
} from "./constants";
import type {
  BulkDirectiveBatchItem,
  BulkDirectiveDepartment,
  BulkDirectiveManagementData,
  BulkDirectiveNormalizedData,
  BulkDirectivePreviewResponse,
  BulkDirectivePreviewRow,
  BulkDirectiveReplaceRegisterResult,
  BulkDirectiveArchiveResult,
  BulkDirectiveRegisterResult,
  BulkImportBatchRow,
  BulkImportRowRow,
} from "./types";

type ParsedSpreadsheetRow = {
  rowNumber: number;
  values: Record<string, string | null>;
};

type ZipEntry = {
  data: Buffer;
  name: string;
};

const DIRECTIVE_BATCH_TYPE = "DIRECTIVE";
const DIRECTIVE_REPLACE_BATCH_TYPE = "DIRECTIVE_REPLACE";
const DIRECTIVE_REPLACE_SOURCE_SHEET_NAMES = ["대표이사 지시사항", "부사장 지시사항"] as const;
const DIRECTIVE_REPLACE_VALIDATION_SHEET_NAME = "통합 지시사항";
const DIRECTIVE_REPLACE_CONFIRM_TEXT = "전체교체";
const DIRECTIVE_REPLACE_ARCHIVE_REASON = "엑셀 재등록 전 기존 지시사항 전체 비노출";
const MAX_DIRECTIVE_NO_RETRIES = 8;
const REPLACE_DEFAULT_DATE = "2026-04-24";
const OPERATING_DEPARTMENT_CODES = new Set([
  "ALL",
  "MANAGEMENT_CENTER",
  "SALES_HQ",
  "PURCHASE_LOGISTICS",
  "FACTORY_HQ",
]);

const DEPARTMENT_ALIASES = new Map<string, string>([
  ["전 부서", "전체"],
  ["전부서", "전체"],
  ["전체", "전체"],
  ["주식회사 씨엔푸드", "전체"],
  ["경영관리부", "경영관리센터"],
  ["경영관리센터", "경영관리센터"],
  ["경영지원센터", "경영관리센터"],
  ["세무회계팀", "경영관리센터"],
  ["자금팀", "경영관리센터"],
  ["인사총무팀", "경영관리센터"],
  ["시설관리팀", "경영관리센터"],
  ["채권관리팀", "경영관리센터"],
  ["운영점검 테스트부서", "경영관리센터"],
  ["기획영업부", "영업본부"],
  ["영업본부", "영업본부"],
  ["기획영업1팀", "영업본부"],
  ["기획영업2팀", "영업본부"],
  ["기획전략팀", "영업본부"],
  ["영업1팀", "영업본부"],
  ["영업2팀", "영업본부"],
  ["영업3팀", "영업본부"],
  ["신규개발팀", "영업본부"],
  ["구매물류부", "구매물류부"],
  ["물류부", "구매물류부"],
  ["물류팀", "구매물류부"],
  ["물류경리팀", "구매물류부"],
  ["공장총괄본부", "공장총괄본부"],
  ["공장총괄", "공장총괄본부"],
  ["생산부", "공장총괄본부"],
  ["육가공", "공장총괄본부"],
  ["육가공팀", "공장총괄본부"],
  ["육가공물류", "공장총괄본부"],
  ["HACCP", "경영관리센터"],
  ["햅썹운용팀", "공장총괄본부"],
  ["인식당", "공장총괄본부"],
  ["R&D", "공장총괄본부"],
  ["각 부서장", "전체"],
  ["각 리더", "전체"],
]);

const REPORT_DEPARTMENT_ALIASES = new Map<string, string>([
  ["전 부서", "전 부서"],
  ["전부서", "전 부서"],
  ["전체", "전 부서"],
  ["주식회사 씨엔푸드", "전 부서"],
  ["경영관리부", "경영관리센터"],
  ["경영관리센터", "경영관리센터"],
  ["경영지원센터", "경영관리센터"],
  ["세무회계팀", "경영관리센터"],
  ["자금팀", "경영관리센터"],
  ["인사총무팀", "경영관리센터"],
  ["시설관리팀", "경영관리센터"],
  ["채권관리팀", "경영관리센터"],
  ["운영점검 테스트부서", "경영관리센터"],
  ["HACCP", "경영관리센터"],
  ["기획영업부", "기획영업부"],
  ["영업본부", "기획영업부"],
  ["기획영업1팀", "기획영업부"],
  ["기획영업2팀", "기획영업부"],
  ["기획전략팀", "기획영업부"],
  ["영업1팀", "기획영업부"],
  ["영업2팀", "기획영업부"],
  ["영업3팀", "기획영업부"],
  ["신규개발팀", "기획영업부"],
  ["구매물류부", "구매물류부"],
  ["물류부", "구매물류부"],
  ["물류팀", "구매물류부"],
  ["물류경리팀", "구매물류부"],
  ["공장총괄본부", "공장총괄본부"],
  ["공장총괄", "공장총괄본부"],
  ["생산부", "공장총괄본부"],
  ["생산팀", "공장총괄본부"],
  ["포장실", "공장총괄본부"],
  ["가공장", "공장총괄본부"],
  ["육가공", "공장총괄본부"],
  ["육가공팀", "공장총괄본부"],
  ["육가공물류", "공장총괄본부"],
  ["햅썹운용팀", "공장총괄본부"],
  ["인식당", "공장총괄본부"],
  ["R&D", "공장총괄본부"],
  ["각 부서장", "각 부서장"],
  ["각 리더", "각 리더"],
]);

const URGENT_TRUE_VALUES = new Set(["1", "Y", "YES", "TRUE", "긴급", "예", "유", "O", "○"]);

function assertBulkAdmin(session: AppSession) {
  if (!isAdminRole(session.role)) {
    throw new ApiError(403, "접근 권한이 없습니다.", null, "BULK_DIRECTIVE_ACCESS_DENIED");
  }
}

function getCellValue(row: Record<string, string | null>, key: string) {
  return row[key]?.trim() || "";
}

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateValue(value: string, fallback?: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallback ?? null;
  }

  if (/^\d{5,}$/.test(trimmed)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Number(trimmed) * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }

  const monthDayMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})$/);

  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    return `2026-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const normalized = trimmed.replace(/[./]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildCreatedAt(meetingDate: string) {
  const safeDate = toDateValue(meetingDate, todayDateValue()) ?? todayDateValue();
  return new Date(`${safeDate}T09:00:00+09:00`).toISOString();
}

function buildDirectiveNumberPrefix(createdAt: string) {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `CN-${year}-${month}-`;
}

function buildYearMonth(createdAt: string) {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function generateDirectiveNumber(client: SupabaseClient, createdAt: string) {
  const prefix = buildDirectiveNumberPrefix(createdAt);
  const { data, error } = await client
    .from("directives")
    .select("directive_no")
    .like("directive_no", `${prefix}%`)
    .order("directive_no", { ascending: false })
    .limit(1);

  if (error) {
    throw new ApiError(500, "관리번호를 생성하지 못했습니다.", error, "BULK_DIRECTIVE_NO_LOAD_FAILED");
  }

  const latestNo = (data?.[0]?.directive_no as string | undefined) ?? null;
  const latestSequence = latestNo ? Number(latestNo.replace(prefix, "")) : 0;
  const sequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1;

  return {
    directiveNo: `${prefix}${String(sequence).padStart(3, "0")}`,
    sequence,
  };
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripXmlTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ""));
}

function parseXmlAttributes(value: string) {
  const attributes = new Map<string, string>();
  const matches = value.matchAll(/([\w:]+)="([^"]*)"/g);

  for (const match of matches) {
    attributes.set(match[1], decodeXml(match[2]));
  }

  return attributes;
}

function parseZipEntries(buffer: Buffer) {
  const entries = new Map<string, ZipEntry>();
  let eocdOffset = -1;

  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new ApiError(400, "엑셀 파일을 읽을 수 없습니다.", null, "BULK_XLSX_EOCD_NOT_FOUND");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new ApiError(400, "엑셀 구조가 올바르지 않습니다.", null, "BULK_XLSX_CENTRAL_DIRECTORY_INVALID");
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new ApiError(400, "엑셀 파일 본문을 읽을 수 없습니다.", null, "BULK_XLSX_LOCAL_HEADER_INVALID");
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data =
      compressionMethod === 0
        ? compressedData
        : compressionMethod === 8
          ? inflateRawSync(compressedData)
          : null;

    if (!data) {
      throw new ApiError(400, "지원하지 않는 엑셀 압축 형식입니다.", null, "BULK_XLSX_COMPRESSION_UNSUPPORTED");
    }

    entries.set(name, { data, name });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml: string | undefined) {
  if (!xml) {
    return [] as string[];
  }

  const strings: string[] = [];
  const itemMatches = xml.matchAll(/<si\b[\s\S]*?<\/si>/g);

  for (const itemMatch of itemMatches) {
    const item = itemMatch[0];
    const textParts = [...item.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]));
    strings.push(textParts.length > 0 ? textParts.join("") : stripXmlTags(item));
  }

  return strings;
}

function columnIndexFromCellRef(cellRef: string) {
  const letters = cellRef.replace(/\d/g, "");
  let column = 0;

  for (const letter of letters) {
    column = column * 26 + letter.toUpperCase().charCodeAt(0) - 64;
  }

  return column - 1;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: Array<{ rowNumber: number; values: string[] }> = [];
  const rowMatches = xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g);

  for (const rowMatch of rowMatches) {
    const rowAttributes = rowMatch[1];
    const rowBody = rowMatch[2];
    const rowNumber = Number(rowAttributes.match(/\br="(\d+)"/)?.[1] ?? rows.length + 1);
    const values: string[] = [];
    const cellMatches = rowBody.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);

    for (const cellMatch of cellMatches) {
      const cellAttributes = cellMatch[1];
      const cellBody = cellMatch[2];
      const cellRef = cellAttributes.match(/\br="([^"]+)"/)?.[1] ?? "";
      const type = cellAttributes.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const valueMatch = cellBody.match(/<v>([\s\S]*?)<\/v>/);
      const inlineMatch = cellBody.match(/<is>([\s\S]*?)<\/is>/);
      const columnIndex = cellRef ? columnIndexFromCellRef(cellRef) : values.length;
      let value = "";

      if (type === "s" && valueMatch) {
        value = sharedStrings[Number(valueMatch[1])] ?? "";
      } else if (type === "inlineStr" && inlineMatch) {
        value = stripXmlTags(inlineMatch[1]);
      } else if (valueMatch) {
        value = decodeXml(valueMatch[1]);
      }

      values[columnIndex] = value.trim();
    }

    rows.push({ rowNumber, values });
  }

  return rows;
}

function findWorksheetEntry(entries: Map<string, ZipEntry>, sheetName?: string) {
  if (!sheetName) {
    return (
      entries.get("xl/worksheets/sheet1.xml") ??
      [...entries.values()].find((entry) => entry.name.startsWith("xl/worksheets/sheet"))
    );
  }

  const workbookXml = entries.get("xl/workbook.xml")?.data.toString("utf8");
  const relationXml = entries.get("xl/_rels/workbook.xml.rels")?.data.toString("utf8");

  if (!workbookXml || !relationXml) {
    throw new ApiError(400, "엑셀 통합 문서 정보를 읽을 수 없습니다.", null, "BULK_XLSX_WORKBOOK_NOT_FOUND");
  }

  const sheetMatch = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)].find((match) => {
    const attributes = parseXmlAttributes(match[1]);
    return attributes.get("name") === sheetName;
  });

  if (!sheetMatch) {
    throw new ApiError(400, `${sheetName} 시트를 찾을 수 없습니다.`, null, "BULK_XLSX_TARGET_SHEET_NOT_FOUND");
  }

  const sheetAttributes = parseXmlAttributes(sheetMatch[1]);
  const relationId = sheetAttributes.get("r:id");
  const relationMatch = [...relationXml.matchAll(/<Relationship\b([^>]*)\/?>/g)].find((match) => {
    const attributes = parseXmlAttributes(match[1]);
    return attributes.get("Id") === relationId;
  });

  if (!relationMatch) {
    throw new ApiError(400, `${sheetName} 시트 위치를 확인할 수 없습니다.`, null, "BULK_XLSX_TARGET_SHEET_REL_NOT_FOUND");
  }

  const target = parseXmlAttributes(relationMatch[1]).get("Target") ?? "";
  const targetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`;

  return entries.get(targetPath);
}

function parseXlsxBuffer(buffer: Buffer, options?: { sheetName?: string }): ParsedSpreadsheetRow[] {
  const entries = parseZipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml")?.data.toString("utf8"));
  const sheetEntry = findWorksheetEntry(entries, options?.sheetName);

  if (!sheetEntry) {
    throw new ApiError(400, "등록양식 시트를 찾을 수 없습니다.", null, "BULK_XLSX_SHEET_NOT_FOUND");
  }

  const worksheetRows = parseWorksheetRows(sheetEntry.data.toString("utf8"), sharedStrings);
  const headerRow = worksheetRows.find((row) => row.values.some(Boolean));

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.values.map((value) => value.trim());

  return worksheetRows
    .filter((row) => row.rowNumber > headerRow.rowNumber)
    .map((row) => {
      const values: Record<string, string | null> = {};

      headers.forEach((header, index) => {
        if (header) {
          values[header] = row.values[index]?.trim() || null;
        }
      });

      return {
        rowNumber: row.rowNumber,
        values,
      };
    })
    .filter((row) => Object.values(row.values).some((value) => value?.trim()));
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvText(text: string): ParsedSpreadsheetRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0] ?? "");

  return lines
    .slice(1)
    .map((line, index) => {
      const values: Record<string, string | null> = {};
      const cells = parseCsvLine(line);

      headers.forEach((header, cellIndex) => {
        if (header) {
          values[header] = cells[cellIndex]?.trim() || null;
        }
      });

      return {
        rowNumber: index + 2,
        values,
      };
    })
    .filter((row) => Object.values(row.values).some((value) => value?.trim()));
}

async function parseSpreadsheetFile(file: File, options?: { sheetName?: string }) {
  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (fileName.endsWith(".csv") || file.type.includes("csv")) {
    return parseCsvText(buffer.toString("utf8"));
  }

  if (fileName.endsWith(".xlsx") || file.type.includes("spreadsheetml")) {
    return parseXlsxBuffer(buffer, options);
  }

  throw new ApiError(400, "엑셀 또는 CSV 파일만 업로드할 수 있습니다.", null, "BULK_FILE_TYPE_INVALID");
}

async function parseReplaceSpreadsheetFile(file: File) {
  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (fileName.endsWith(".csv") || file.type.includes("csv")) {
    return parseCsvText(buffer.toString("utf8"));
  }

  if (fileName.endsWith(".xlsx") || file.type.includes("spreadsheetml")) {
    return DIRECTIVE_REPLACE_SOURCE_SHEET_NAMES.flatMap((sheetName, sheetIndex) =>
      parseXlsxBuffer(buffer, { sheetName }).map((row) => ({
        rowNumber: sheetIndex * 1000 + row.rowNumber,
        values: {
          ...row.values,
          원본시트: sheetName,
        },
      })),
    );
  }

  throw new ApiError(400, "엑셀 또는 CSV 파일만 업로드할 수 있습니다.", null, "BULK_REPLACE_FILE_TYPE_INVALID");
}

function normalizeUrgentValue(value: string) {
  return URGENT_TRUE_VALUES.has(value.trim().toUpperCase());
}

function normalizeUrgentLevel(value: string, isUrgent: boolean): DirectiveUrgentLevel | null {
  if (!isUrgent) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (!normalized || ["일반", "없음", "보통"].includes(value.trim())) {
    return "HIGH";
  }

  if (["1", "LOW", "낮음"].includes(normalized) || value.trim() === "낮음") {
    return "LOW";
  }

  if (["2", "HIGH", "높음", "긴급"].includes(normalized) || value.trim() === "높음") {
    return "HIGH";
  }

  if (["3", "CRITICAL", "매우 긴급", "최상"].includes(normalized) || value.trim() === "매우 긴급") {
    return "CRITICAL";
  }

  return "HIGH";
}

function normalizeDepartmentLabel(value: string) {
  const trimmed = value.trim();
  return DEPARTMENT_ALIASES.get(trimmed) ?? trimmed;
}

function buildReportDepartmentLabel(rawValue: string) {
  const labels = rawValue
    .split(/\s*(?:,|\/|\\|\||ㆍ|·|，|、|;|；|\n|\r|\+|&)\s*/)
    .map((label) => {
      const trimmed = label.trim();
      return REPORT_DEPARTMENT_ALIASES.get(trimmed) ?? trimmed;
    })
    .filter(Boolean);

  return [...new Set(labels)].join(", ");
}

function resolveDepartments(
  rawValue: string,
  departments: BulkDirectiveDepartment[],
  options: { expandAllDepartment?: boolean } = {},
) {
  const errors: string[] = [];
  const expandAllDepartment = options.expandAllDepartment ?? true;
  const labels = rawValue
    .split(/\s*(?:,|\/|\\|\||ㆍ|·|，|、|;|；|\n|\r|\+|&)\s*/)
    .map(normalizeDepartmentLabel)
    .filter(Boolean);

  if (labels.length === 0) {
    return {
      departmentIds: [] as string[],
      departmentNames: [] as string[],
      errors: ["담당부서를 입력해주세요."],
    };
  }

  const uniqueLabels = [...new Set(labels)];
  const includesAll = uniqueLabels.includes("전체");

  if (includesAll && expandAllDepartment) {
    return {
      departmentIds: departments.map((department) => department.id),
      departmentNames: ["전체"],
      errors,
    };
  }

  const departmentIds: string[] = [];
  const departmentNames: string[] = [];

  for (const label of uniqueLabels) {
    if (!BULK_DIRECTIVE_ALLOWED_DEPARTMENTS.includes(label as (typeof BULK_DIRECTIVE_ALLOWED_DEPARTMENTS)[number])) {
      errors.push(`허용되지 않는 부서입니다: ${label}`);
      continue;
    }

    const department = departments.find((item) => item.name === label);

    if (!department) {
      errors.push(`운영 부서에서 찾을 수 없습니다: ${label}`);
      continue;
    }

    departmentIds.push(department.id);
    departmentNames.push(department.name);
  }

  return {
    departmentIds,
    departmentNames,
    errors,
  };
}

function normalizeStatus(rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      errors: [] as string[],
      status: "IN_PROGRESS" as DirectiveStatus,
    };
  }

  const status = BULK_DIRECTIVE_STATUS_LABEL_TO_VALUE[trimmed];

  if (!status) {
    return {
      errors: [`허용되지 않는 상태입니다: ${trimmed}`],
      status: "IN_PROGRESS" as DirectiveStatus,
    };
  }

  return {
    errors: [] as string[],
    status,
  };
}

function normalizeReportBucket(rawValue: string) {
  const trimmed = rawValue.trim();

  if (trimmed === "완료" || trimmed === "지속" || trimmed === "진행중") {
    return trimmed;
  }

  return trimmed ? BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL[normalizeStatus(trimmed).status] : "진행중";
}

function normalizeTitle(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function validateAndNormalizeRow(
  parsedRow: ParsedSpreadsheetRow,
  departments: BulkDirectiveDepartment[],
): Omit<BulkDirectivePreviewRow, "batchRowId"> & { normalizedData: BulkDirectiveNormalizedData | null; rawData: Record<string, string | null> } {
  const errors: string[] = [];
  const rawData = parsedRow.values;

  for (const column of BULK_DIRECTIVE_REQUIRED_COLUMNS) {
    if (!(column in rawData)) {
      errors.push(`필수 컬럼이 없습니다: ${column}`);
    }
  }

  const directiveText = getCellValue(rawData, "지시사항");
  const rawDepartments = getCellValue(rawData, "담당부서");
  const meetingDate = toDateValue(getCellValue(rawData, "회의일"), todayDateValue()) ?? todayDateValue();
  const dueDate = toDateValue(getCellValue(rawData, "마감일"));
  const isUrgent = normalizeUrgentValue(getCellValue(rawData, "긴급여부"));
  const urgentLevel = normalizeUrgentLevel(getCellValue(rawData, "긴급등급"), isUrgent);
  const statusResult = normalizeStatus(getCellValue(rawData, "상태"));
  const departmentResult = resolveDepartments(rawDepartments, departments);
  const note = getCellValue(rawData, "비고") || null;
  const chairRole = getCellValue(rawData, "주관") || null;

  errors.push(...statusResult.errors, ...departmentResult.errors);

  if (!directiveText) {
    errors.push("지시사항을 입력해주세요.");
  }

  if (!rawDepartments) {
    errors.push("담당부서를 입력해주세요.");
  }

  if (getCellValue(rawData, "마감일") && !dueDate) {
    errors.push("마감일 형식을 확인해주세요.");
  }

  const title = normalizeTitle(directiveText || "지시사항 입력 필요");
  const contentParts = [directiveText, note ? `비고: ${note}` : null, chairRole ? `주관: ${chairRole}` : null].filter(Boolean);
  const normalizedData: BulkDirectiveNormalizedData | null =
    errors.length === 0
      ? {
          chairRole,
          content: contentParts.join("\n"),
          departmentIds: departmentResult.departmentIds,
          departments: departmentResult.departmentNames,
          dueDate,
          isUrgent,
          meetingDate,
          note,
          status: statusResult.status,
          statusLabel: BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL[statusResult.status],
          title,
          urgentLevel,
        }
      : null;

  return {
    rawData,
    normalizedData,
    chairRole,
    content: normalizedData?.content ?? directiveText,
    departments: departmentResult.departmentNames.length > 0 ? departmentResult.departmentNames : rawDepartments ? [rawDepartments] : [],
    dueDate,
    errors,
    isUrgent,
    meetingDate,
    note,
    rowNumber: parsedRow.rowNumber,
    status: statusResult.status,
    statusLabel: BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL[statusResult.status],
    title,
    urgentLevel,
    valid: errors.length === 0,
  };
}

function buildPlannedDirectiveNumber(meetingDate: string, sequenceByYearMonth: Map<string, number>) {
  const yearMonth = meetingDate.slice(0, 7);
  const sequence = (sequenceByYearMonth.get(yearMonth) ?? 0) + 1;

  sequenceByYearMonth.set(yearMonth, sequence);

  return {
    directiveNo: `CN-${yearMonth}-${String(sequence).padStart(3, "0")}`,
    sequence,
    yearMonth,
  };
}

function validateAndNormalizeReplaceRow(
  parsedRow: ParsedSpreadsheetRow,
  departments: BulkDirectiveDepartment[],
  sequenceByYearMonth: Map<string, number>,
): Omit<BulkDirectivePreviewRow, "batchRowId"> & { normalizedData: BulkDirectiveNormalizedData | null; rawData: Record<string, string | null> } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawData = parsedRow.values;

  for (const column of BULK_DIRECTIVE_REPLACE_REQUIRED_COLUMNS) {
    if (!(column in rawData)) {
      errors.push(`필수 컬럼이 없습니다: ${column}`);
    }
  }

  const directiveText = getCellValue(rawData, "지시사항");
  const rawDepartments = getCellValue(rawData, "담당부서");
  const rawMeetingDate = getCellValue(rawData, "회의일");
  const rawDueDate = getCellValue(rawData, "기한");
  const rawNote = getCellValue(rawData, "비고");
  const sourceSheet = getCellValue(rawData, "원본시트");
  const meetingDate = toDateValue(rawMeetingDate, REPLACE_DEFAULT_DATE) ?? REPLACE_DEFAULT_DATE;
  const dueDateFromDueColumn = rawDueDate ? toDateValue(rawDueDate) : null;
  const dueDateFromNoteFallback = !rawDueDate && rawNote ? toDateValue(rawNote) : null;
  const dueDate = dueDateFromDueColumn ?? dueDateFromNoteFallback;
  const note = rawNote || rawDueDate || null;
  const rawStatus = getCellValue(rawData, "상태");
  const statusResult = normalizeStatus(rawStatus);
  const reportBucket = normalizeReportBucket(rawStatus);
  const departmentResult = resolveDepartments(rawDepartments, departments, { expandAllDepartment: false });
  const reportDepartmentLabel = buildReportDepartmentLabel(rawDepartments);
  const chairRole = getCellValue(rawData, "주관") || null;
  const sourceNo = getCellValue(rawData, "No.") || null;
  const planned = buildPlannedDirectiveNumber(meetingDate, sequenceByYearMonth);

  errors.push(...statusResult.errors, ...departmentResult.errors);

  if (!BULK_DIRECTIVE_REPLACE_NOTE_COLUMNS.some((column) => column in rawData)) {
    warnings.push("기한/비고 컬럼이 없어 기한 원문 없이 등록됩니다.");
  }

  if (!directiveText) {
    errors.push("지시사항을 입력해주세요.");
  }

  if (!rawDepartments) {
    errors.push("담당부서를 입력해주세요.");
  }

  if (!rawMeetingDate) {
    warnings.push("회의일이 비어 있어 파일 기준일로 처리됩니다.");
  } else if (!toDateValue(rawMeetingDate)) {
    errors.push("회의일 형식을 확인해주세요.");
  }

  if (rawDueDate && !dueDateFromDueColumn) {
    errors.push("기한 형식을 확인해주세요.");
  }

  const title = normalizeTitle(directiveText || "지시사항 입력 필요");
  const contentParts = [
    directiveText,
    chairRole ? `주관: ${chairRole}` : null,
    sourceNo ? `엑셀 No.: ${sourceNo}` : null,
    sourceSheet ? `원본시트: ${sourceSheet}` : null,
    rawStatus ? `원본상태: ${rawStatus}` : null,
    `보고상태: ${reportBucket}`,
    rawDepartments ? `원본담당부서: ${rawDepartments}` : null,
    reportDepartmentLabel ? `보고담당부서: ${reportDepartmentLabel}` : null,
    rawDueDate ? `기한: ${rawDueDate}` : null,
    rawNote ? `비고: ${rawNote}` : null,
  ].filter(Boolean);
  const normalizedData: BulkDirectiveNormalizedData | null =
    errors.length === 0
      ? {
          chairRole,
          content: contentParts.join("\n"),
          departmentIds: departmentResult.departmentIds,
          departments: departmentResult.departmentNames,
          directiveNo: planned.directiveNo,
          dueDate,
          isUrgent: false,
          meetingDate,
          note,
          sequence: planned.sequence,
          sourceNo,
          status: statusResult.status,
          statusLabel: BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL[statusResult.status],
          targetScope: "SELECTED",
          title,
          urgentLevel: null,
          warnings,
          yearMonth: planned.yearMonth,
        }
      : null;

  return {
    rawData,
    normalizedData,
    chairRole,
    content: normalizedData?.content ?? directiveText,
    departments: departmentResult.departmentNames.length > 0 ? departmentResult.departmentNames : rawDepartments ? [rawDepartments] : [],
    directiveNo: planned.directiveNo,
    dueDate,
    errors,
    isUrgent: false,
    meetingDate,
    note,
    rowNumber: parsedRow.rowNumber,
    status: statusResult.status,
    statusLabel: BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL[statusResult.status],
    title,
    urgentLevel: null,
    valid: errors.length === 0,
    warnings,
  };
}

function isOperatingDepartment(department: BulkDirectiveDepartment) {
  if (department.code && OPERATING_DEPARTMENT_CODES.has(department.code)) {
    return true;
  }

  return BULK_DIRECTIVE_ALLOWED_DEPARTMENTS.includes(
    department.name as (typeof BULK_DIRECTIVE_ALLOWED_DEPARTMENTS)[number],
  );
}

async function loadBulkDepartments(client: SupabaseClient): Promise<BulkDirectiveDepartment[]> {
  const { data, error } = await client
    .from("departments")
    .select("id, name, code, head_user_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    throw new ApiError(500, "운영 부서를 불러오지 못했습니다.", error, "BULK_DEPARTMENTS_LOAD_FAILED");
  }

  const departments = ((data ?? []) as Array<{ code: string | null; head_user_id: string | null; id: string; name: string }>).map(
    (department) => ({
      code: department.code,
      headUserId: department.head_user_id,
      id: department.id,
      name: department.name,
    }),
  );
  const operatingDepartments = departments.filter(isOperatingDepartment);

  return operatingDepartments.length > 0 ? operatingDepartments : departments;
}

function toStoredRow(row: {
  errors: string[];
  normalizedData: BulkDirectiveNormalizedData | null;
  rawData: Record<string, string | null>;
  rowNumber: number;
  valid: boolean;
}) {
  return {
    errors: row.errors,
    normalized_data: row.normalizedData,
    raw_data: row.rawData,
    row_number: row.rowNumber,
    valid: row.valid,
  };
}

function toPreviewRow(row: BulkImportRowRow): BulkDirectivePreviewRow {
  const normalized = row.normalized_data;

  return {
    batchRowId: row.id,
    chairRole: normalized?.chairRole ?? null,
    content: normalized?.content ?? "",
    departments: normalized?.departments ?? [],
    directiveNo: normalized?.directiveNo ?? null,
    dueDate: normalized?.dueDate ?? null,
    errors: Array.isArray(row.errors) ? row.errors : [],
    isUrgent: normalized?.isUrgent ?? false,
    meetingDate: normalized?.meetingDate ?? "",
    note: normalized?.note ?? null,
    rowNumber: row.row_number,
    status: normalized?.status ?? "IN_PROGRESS",
    statusLabel: normalized?.statusLabel ?? "진행중",
    title: normalized?.title ?? "",
    urgentLevel: normalized?.urgentLevel ?? null,
    valid: row.valid,
    warnings: normalized?.warnings ?? [],
  };
}

export async function getBulkDirectiveManagementDataAsSession(
  session: AppSession,
): Promise<BulkDirectiveManagementData> {
  assertBulkAdmin(session);

  const client = createSupabaseServerClient();
  const { data: batches, error } = await client
    .from("bulk_import_batches")
    .select(
      "id, type, file_name, status, total_rows, valid_rows, invalid_rows, created_by, created_at, registered_at, archived_directives_count, archive_reason, replace_mode",
    )
    .in("type", [DIRECTIVE_BATCH_TYPE, DIRECTIVE_REPLACE_BATCH_TYPE])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new ApiError(500, "등록 내역을 불러오지 못했습니다.", error, "BULK_BATCHES_LOAD_FAILED");
  }

  const rows = (batches ?? []) as BulkImportBatchRow[];
  const batchIds = rows.map((batch) => batch.id);
  const creatorIds = [...new Set(rows.map((batch) => batch.created_by).filter(Boolean))];
  const registeredCountByBatch = new Map<string, number>();
  const createdByNames = new Map<string, string>();

  if (batchIds.length > 0) {
    const { data: importRows, error: rowError } = await client
      .from("bulk_import_rows")
      .select("batch_id, directive_id")
      .in("batch_id", batchIds);

    if (rowError) {
      throw new ApiError(500, "등록 행 정보를 불러오지 못했습니다.", rowError, "BULK_ROWS_LOAD_FAILED");
    }

    for (const row of importRows ?? []) {
      if (row.directive_id) {
        registeredCountByBatch.set(row.batch_id, (registeredCountByBatch.get(row.batch_id) ?? 0) + 1);
      }
    }
  }

  if (creatorIds.length > 0) {
    const { data: users, error: userError } = await client
      .from("users")
      .select("id, name, profile_name")
      .in("id", creatorIds);

    if (userError) {
      throw new ApiError(500, "등록자 정보를 불러오지 못했습니다.", userError, "BULK_USERS_LOAD_FAILED");
    }

    for (const user of users ?? []) {
      createdByNames.set(user.id, user.profile_name?.trim() || user.name || "등록자 미확인");
    }
  }

  return {
    batches: rows.map<BulkDirectiveBatchItem>((batch) => ({
      createdAt: batch.created_at,
      createdByName: createdByNames.get(batch.created_by) ?? null,
      fileName: batch.file_name,
      id: batch.id,
      invalidRows: batch.invalid_rows,
      archivedDirectivesCount: batch.archived_directives_count ?? 0,
      archiveReason: batch.archive_reason ?? null,
      registeredAt: batch.registered_at,
      registeredCount: registeredCountByBatch.get(batch.id) ?? 0,
      status: batch.status,
      totalRows: batch.total_rows,
      validRows: batch.valid_rows,
    })),
  };
}

export async function previewBulkDirectivesAsSession(
  session: AppSession,
  file: File | null,
): Promise<BulkDirectivePreviewResponse> {
  assertBulkAdmin(session);

  if (!file || file.size === 0) {
    throw new ApiError(400, "업로드할 엑셀 파일을 선택해주세요.", null, "BULK_FILE_REQUIRED");
  }

  const client = createSupabaseServerClient();
  const departments = await loadBulkDepartments(client);
  const parsedRows = await parseSpreadsheetFile(file);
  const previewRows = parsedRows.map((row) => validateAndNormalizeRow(row, departments));
  const validRows = previewRows.filter((row) => row.valid).length;
  const invalidRows = previewRows.length - validRows;
  const batchId = crypto.randomUUID();

  const { error: batchError } = await client.from("bulk_import_batches").insert({
    created_by: session.userId,
    file_name: file.name || "업로드 파일",
    id: batchId,
    invalid_rows: invalidRows,
    status: "PREVIEW",
    total_rows: previewRows.length,
    type: DIRECTIVE_BATCH_TYPE,
    valid_rows: validRows,
  });

  if (batchError) {
    throw new ApiError(500, "검증 내역을 저장하지 못했습니다.", batchError, "BULK_BATCH_CREATE_FAILED");
  }

  if (previewRows.length > 0) {
    const { error: rowError } = await client.from("bulk_import_rows").insert(
      previewRows.map((row) => ({
        ...toStoredRow(row),
        batch_id: batchId,
        id: crypto.randomUUID(),
      })),
    );

    if (rowError) {
      throw new ApiError(500, "검증 행을 저장하지 못했습니다.", rowError, "BULK_ROWS_CREATE_FAILED");
    }
  }

  const { data: storedRows, error: loadError } = await client
    .from("bulk_import_rows")
    .select("id, batch_id, row_number, raw_data, normalized_data, valid, errors, directive_id, created_at")
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });

  if (loadError) {
    throw new ApiError(500, "미리보기 행을 불러오지 못했습니다.", loadError, "BULK_PREVIEW_LOAD_FAILED");
  }

  await recordHistory(client, {
    action: "BULK_DIRECTIVE_PREVIEW_CREATED",
    actorId: session.userId,
    entityId: batchId,
    entityType: "bulk_import_batch",
    metadata: {
      fileName: file.name,
      invalidRows,
      totalRows: previewRows.length,
      validRows,
    },
  });

  return {
    batchId,
    invalidRows,
    rows: ((storedRows ?? []) as BulkImportRowRow[]).map(toPreviewRow),
    totalRows: previewRows.length,
    validRows,
  };
}

async function countActiveDirectives(client: SupabaseClient) {
  const { count, error } = await client
    .from("directives")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false);

  if (error) {
    throw new ApiError(500, "기존 활성 지시사항 수를 확인하지 못했습니다.", error, "BULK_REPLACE_ACTIVE_COUNT_FAILED");
  }

  return count ?? 0;
}

export async function previewReplaceDirectivesAsSession(
  session: AppSession,
  file: File | null,
): Promise<BulkDirectivePreviewResponse> {
  assertBulkAdmin(session);

  if (!file || file.size === 0) {
    throw new ApiError(400, "업로드할 엑셀 파일을 선택해주세요.", null, "BULK_REPLACE_FILE_REQUIRED");
  }

  const client = createSupabaseServerClient();
  const departments = await loadBulkDepartments(client);
  const parsedRows = await parseReplaceSpreadsheetFile(file);
  const sequenceByYearMonth = new Map<string, number>();
  const previewRows = parsedRows.map((row) => validateAndNormalizeReplaceRow(row, departments, sequenceByYearMonth));
  const validRows = previewRows.filter((row) => row.valid).length;
  const invalidRows = previewRows.length - validRows;
  const activeDirectivesCount = await countActiveDirectives(client);
  const batchId = crypto.randomUUID();

  const { error: batchError } = await client.from("bulk_import_batches").insert({
    archive_reason: DIRECTIVE_REPLACE_ARCHIVE_REASON,
    archived_directives_count: 0,
    created_by: session.userId,
    file_name: file.name || "업로드 파일",
    id: batchId,
    invalid_rows: invalidRows,
    replace_mode: true,
    status: "PREVIEW",
    total_rows: previewRows.length,
    type: DIRECTIVE_REPLACE_BATCH_TYPE,
    valid_rows: validRows,
  });

  if (batchError) {
    throw new ApiError(500, "전체 교체 검증 내역을 저장하지 못했습니다.", batchError, "BULK_REPLACE_BATCH_CREATE_FAILED");
  }

  if (previewRows.length > 0) {
    const { error: rowError } = await client.from("bulk_import_rows").insert(
      previewRows.map((row) => ({
        ...toStoredRow(row),
        batch_id: batchId,
        id: crypto.randomUUID(),
      })),
    );

    if (rowError) {
      throw new ApiError(500, "전체 교체 검증 행을 저장하지 못했습니다.", rowError, "BULK_REPLACE_ROWS_CREATE_FAILED");
    }
  }

  const { data: storedRows, error: loadError } = await client
    .from("bulk_import_rows")
    .select("id, batch_id, row_number, raw_data, normalized_data, valid, errors, directive_id, created_at")
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });

  if (loadError) {
    throw new ApiError(500, "전체 교체 미리보기 행을 불러오지 못했습니다.", loadError, "BULK_REPLACE_PREVIEW_LOAD_FAILED");
  }

  await recordHistory(client, {
    action: "BULK_DIRECTIVE_REPLACE_PREVIEW_CREATED",
    actorId: session.userId,
    entityId: batchId,
    entityType: "bulk_import_batch",
    metadata: {
      activeDirectivesCount,
      fileName: file.name,
      invalidRows,
      sourceSheetNames: [...DIRECTIVE_REPLACE_SOURCE_SHEET_NAMES],
      validationSheetName: DIRECTIVE_REPLACE_VALIDATION_SHEET_NAME,
      totalRows: previewRows.length,
      validRows,
    },
  });

  return {
    activeDirectivesCount,
    batchId,
    invalidRows,
    replaceMode: true,
    rows: ((storedRows ?? []) as BulkImportRowRow[]).map(toPreviewRow),
    totalRows: previewRows.length,
    validRows,
  };
}

async function createBulkDirective(
  client: SupabaseClient,
  session: AppSession,
  row: BulkImportRowRow,
  departments: BulkDirectiveDepartment[],
) {
  const normalized = row.normalized_data;

  if (!normalized) {
    throw new ApiError(400, "정상 검증된 행만 등록할 수 있습니다.", null, "BULK_ROW_INVALID");
  }

  const activeDepartmentIds = new Set(departments.map((department) => department.id));
  const targetDepartmentIds = [...new Set(normalized.departmentIds)].filter((departmentId) =>
    activeDepartmentIds.has(departmentId),
  );

  if (targetDepartmentIds.length === 0) {
    throw new ApiError(400, "등록할 담당부서를 찾을 수 없습니다.", null, "BULK_ROW_DEPARTMENT_MISSING");
  }

  const departmentMap = new Map(departments.map((department) => [department.id, department]));
  const createdAt = buildCreatedAt(normalized.meetingDate);
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < MAX_DIRECTIVE_NO_RETRIES; attempt += 1) {
    const generated = await generateDirectiveNumber(client, createdAt);
    const directiveId = crypto.randomUUID();
    const insertDirective = await client
      .from("directives")
      .insert({
        content: normalized.content,
        created_at: createdAt,
        created_by: session.userId,
        directive_no: generated.directiveNo,
        due_date: normalized.dueDate,
        id: directiveId,
        is_archived: false,
        is_urgent: normalized.isUrgent,
        owner_department_id: targetDepartmentIds[0],
        owner_user_id: null,
        sequence: generated.sequence,
        status: normalized.status,
        target_scope: targetDepartmentIds.length === departments.length ? "ALL" : "SELECTED",
        title: normalized.title,
        updated_at: now,
        urgent_level: normalized.urgentLevel,
        year_month: buildYearMonth(createdAt),
      })
      .select("id, directive_no, title, status")
      .single<{ directive_no: string; id: string; status: DirectiveStatus; title: string }>();

    if (insertDirective.error) {
      if (insertDirective.error.code === "23505") {
        continue;
      }

      throw new ApiError(500, "지시사항을 등록하지 못했습니다.", insertDirective.error, "BULK_DIRECTIVE_CREATE_FAILED");
    }

    const assignmentRows = targetDepartmentIds.map((departmentId, index) => {
      const department = departmentMap.get(departmentId);

      return {
        assigned_at: createdAt,
        assignment_role: index === 0 ? "OWNER" : "SUPPORT",
        department_closed_at: normalized.status === "COMPLETED" ? now : null,
        department_due_date: normalized.dueDate,
        department_head_id: department?.headUserId ?? null,
        department_id: departmentId,
        department_status: normalized.status,
        directive_id: insertDirective.data.id,
        id: crypto.randomUUID(),
        is_primary: index === 0,
        updated_at: now,
      };
    });
    const insertAssignments = await client.from("directive_departments").insert(assignmentRows);

    if (insertAssignments.error) {
      throw new ApiError(500, "담당부서 배정을 등록하지 못했습니다.", insertAssignments.error, "BULK_ASSIGNMENTS_CREATE_FAILED");
    }

    await recordHistory(client, {
      action: "BULK_DIRECTIVE_CREATED",
      actorId: session.userId,
      afterData: insertDirective.data,
      entityId: insertDirective.data.id,
      entityType: "directive",
      metadata: {
        batchId: row.batch_id,
        rowId: row.id,
        rowNumber: row.row_number,
      },
    });

    return insertDirective.data;
  }

  throw new ApiError(409, "관리번호가 중복되어 등록하지 못했습니다. 다시 시도해주세요.", null, "BULK_DIRECTIVE_NO_CONFLICT");
}

function findAllDepartmentId(departments: BulkDirectiveDepartment[]) {
  return departments.find((department) => department.code === "ALL")?.id ?? departments.find((department) => department.name === "전체")?.id ?? null;
}

function buildReplaceTargetDepartmentIds(normalized: BulkDirectiveNormalizedData, departments: BulkDirectiveDepartment[]) {
  const activeDepartmentIds = new Set(departments.map((department) => department.id));
  const selectedIds = [...new Set(normalized.departmentIds)].filter((departmentId) => activeDepartmentIds.has(departmentId));

  return selectedIds;
}

async function archiveActiveDirectivesForReplace(
  client: SupabaseClient,
  session: AppSession,
  archivedAt: string,
  archiveSuffix: string,
) {
  const { data: directives, error } = await client
    .from("directives")
    .select("id, directive_no")
    .eq("is_archived", false);

  if (error) {
    throw new ApiError(500, "기존 지시사항을 불러오지 못했습니다.", error, "BULK_REPLACE_ACTIVE_LOAD_FAILED");
  }

  const activeDirectives = (directives ?? []) as Array<{ directive_no: string; id: string }>;

  for (const directive of activeDirectives) {
    const { error: updateError } = await client
      .from("directives")
      .update({
        archive_reason: DIRECTIVE_REPLACE_ARCHIVE_REASON,
        archived_at: archivedAt,
        archived_by: session.userId,
        directive_no: `OLD-${directive.directive_no}-${archiveSuffix}`,
        is_archived: true,
        updated_at: archivedAt,
      })
      .eq("id", directive.id)
      .eq("is_archived", false);

    if (updateError) {
      throw new ApiError(500, "기존 지시사항을 비노출 처리하지 못했습니다.", updateError, "BULK_REPLACE_ARCHIVE_FAILED");
    }
  }

  return activeDirectives.length;
}

async function releaseDirectiveNumberConflicts(
  client: SupabaseClient,
  session: AppSession,
  plannedDirectiveNos: string[],
  archivedAt: string,
  archiveSuffix: string,
) {
  const uniqueNos = [...new Set(plannedDirectiveNos.filter(Boolean))];

  if (uniqueNos.length === 0) {
    return;
  }

  const { data: conflicts, error } = await client
    .from("directives")
    .select("id, directive_no")
    .in("directive_no", uniqueNos);

  if (error) {
    throw new ApiError(500, "관리번호 중복 여부를 확인하지 못했습니다.", error, "BULK_REPLACE_NO_CONFLICT_LOAD_FAILED");
  }

  for (const directive of (conflicts ?? []) as Array<{ directive_no: string; id: string }>) {
    const { error: updateError } = await client
      .from("directives")
      .update({
        archive_reason: DIRECTIVE_REPLACE_ARCHIVE_REASON,
        archived_at: archivedAt,
        archived_by: session.userId,
        directive_no: `OLD-${directive.directive_no}-${archiveSuffix}-${directive.id.slice(0, 8)}`,
        is_archived: true,
        updated_at: archivedAt,
      })
      .eq("id", directive.id);

    if (updateError) {
      throw new ApiError(500, "기존 관리번호 충돌을 정리하지 못했습니다.", updateError, "BULK_REPLACE_NO_CONFLICT_UPDATE_FAILED");
    }
  }
}

async function createReplaceDirective(
  client: SupabaseClient,
  session: AppSession,
  row: BulkImportRowRow,
  departments: BulkDirectiveDepartment[],
) {
  const normalized = row.normalized_data;

  if (!normalized?.directiveNo || !normalized.sequence || !normalized.yearMonth) {
    throw new ApiError(400, "정상 검증된 교체 행만 등록할 수 있습니다.", null, "BULK_REPLACE_ROW_INVALID");
  }

  const targetDepartmentIds = buildReplaceTargetDepartmentIds(normalized, departments);

  if (targetDepartmentIds.length === 0) {
    throw new ApiError(400, "등록할 담당부서를 찾을 수 없습니다.", null, "BULK_REPLACE_ROW_DEPARTMENT_MISSING");
  }

  const departmentMap = new Map(departments.map((department) => [department.id, department]));
  const allDepartmentId = findAllDepartmentId(departments);
  const createdAt = buildCreatedAt(normalized.meetingDate);
  const now = new Date().toISOString();
  const ownerDepartmentId =
    targetDepartmentIds.find((departmentId) => departmentId !== allDepartmentId) ?? targetDepartmentIds[0];
  const directiveId = crypto.randomUUID();
  const insertDirective = await client
    .from("directives")
    .insert({
      content: normalized.content,
      created_at: createdAt,
      created_by: session.userId,
      directive_no: normalized.directiveNo,
      due_date: normalized.dueDate,
      id: directiveId,
      is_archived: false,
      is_urgent: false,
      owner_department_id: ownerDepartmentId,
      owner_user_id: null,
      sequence: normalized.sequence,
      status: normalized.status,
      target_scope: normalized.targetScope ?? "SELECTED",
      title: normalized.title,
      updated_at: now,
      urgent_level: null,
      year_month: normalized.yearMonth,
    })
    .select("id, directive_no, title, status")
    .single<{ directive_no: string; id: string; status: DirectiveStatus; title: string }>();

  if (insertDirective.error) {
    throw new ApiError(500, "엑셀 지시사항을 등록하지 못했습니다.", insertDirective.error, "BULK_REPLACE_DIRECTIVE_CREATE_FAILED");
  }

  const assignmentRows = targetDepartmentIds.map((departmentId) => {
    const department = departmentMap.get(departmentId);
    const isOwner = departmentId === ownerDepartmentId;

    return {
      assigned_at: createdAt,
      assignment_role: isOwner ? "OWNER" : departmentId === allDepartmentId ? "REFERENCE" : "SUPPORT",
      created_at: createdAt,
      department_closed_at: normalized.status === "COMPLETED" ? now : null,
      department_due_date: normalized.dueDate,
      department_head_id: department?.headUserId ?? null,
      department_id: departmentId,
      department_status: normalized.status,
      directive_id: insertDirective.data.id,
      id: crypto.randomUUID(),
      is_primary: isOwner,
      updated_at: now,
    };
  });
  const insertAssignments = await client.from("directive_departments").insert(assignmentRows);

  if (insertAssignments.error) {
    throw new ApiError(500, "엑셀 담당부서 배정을 등록하지 못했습니다.", insertAssignments.error, "BULK_REPLACE_ASSIGNMENTS_CREATE_FAILED");
  }

  await recordHistory(client, {
    action: "BULK_REPLACE_DIRECTIVE_CREATED",
    actorId: session.userId,
    afterData: insertDirective.data,
    entityId: insertDirective.data.id,
    entityType: "directive",
    metadata: {
      batchId: row.batch_id,
      rowId: row.id,
      rowNumber: row.row_number,
    },
  });

  return insertDirective.data;
}

export async function registerBulkDirectivesAsSession(
  session: AppSession,
  input: { batchId: string; selectedRowIds: string[] },
): Promise<BulkDirectiveRegisterResult> {
  assertBulkAdmin(session);

  const client = createSupabaseServerClient();
  const { data: batch, error: batchError } = await client
    .from("bulk_import_batches")
    .select("id, status")
    .eq("id", input.batchId)
    .eq("type", DIRECTIVE_BATCH_TYPE)
    .maybeSingle<{ id: string; status: string }>();

  if (batchError) {
    throw new ApiError(500, "일괄등록 내역을 확인하지 못했습니다.", batchError, "BULK_BATCH_LOAD_FAILED");
  }

  if (!batch) {
    throw new ApiError(404, "일괄등록 내역을 찾을 수 없습니다.", null, "BULK_BATCH_NOT_FOUND");
  }

  if (batch.status !== "PREVIEW") {
    throw new ApiError(400, "미리보기 상태의 내역만 등록할 수 있습니다.", null, "BULK_BATCH_NOT_PREVIEW");
  }

  const { data: rows, error: rowError } = await client
    .from("bulk_import_rows")
    .select("id, batch_id, row_number, raw_data, normalized_data, valid, errors, directive_id, created_at")
    .eq("batch_id", input.batchId)
    .in("id", input.selectedRowIds)
    .order("row_number", { ascending: true });

  if (rowError) {
    throw new ApiError(500, "선택한 행을 불러오지 못했습니다.", rowError, "BULK_SELECTED_ROWS_LOAD_FAILED");
  }

  const selectedRows = (rows ?? []) as BulkImportRowRow[];

  if (selectedRows.length === 0) {
    throw new ApiError(400, "등록할 행을 선택해주세요.", null, "BULK_REGISTER_ROWS_REQUIRED");
  }

  const invalidRows = selectedRows.filter((row) => !row.valid || row.directive_id);

  if (invalidRows.length > 0) {
    throw new ApiError(400, "오류가 있거나 이미 등록된 행은 등록할 수 없습니다.", null, "BULK_REGISTER_ROWS_INVALID");
  }

  const departments = await loadBulkDepartments(client);
  const createdDirectiveIds: string[] = [];

  for (const row of selectedRows) {
    const directive = await createBulkDirective(client, session, row, departments);
    const { error: updateRowError } = await client
      .from("bulk_import_rows")
      .update({
        directive_id: directive.id,
      })
      .eq("id", row.id)
      .is("directive_id", null);

    if (updateRowError) {
      throw new ApiError(500, "등록 행의 처리 결과를 저장하지 못했습니다.", updateRowError, "BULK_ROW_UPDATE_FAILED");
    }

    createdDirectiveIds.push(directive.id);
  }

  const { error: batchUpdateError } = await client
    .from("bulk_import_batches")
    .update({
      registered_at: new Date().toISOString(),
      status: "REGISTERED",
    })
    .eq("id", input.batchId);

  if (batchUpdateError) {
    throw new ApiError(500, "일괄등록 상태를 저장하지 못했습니다.", batchUpdateError, "BULK_BATCH_REGISTER_UPDATE_FAILED");
  }

  await recordHistory(client, {
    action: "BULK_DIRECTIVES_REGISTERED",
    actorId: session.userId,
    entityId: input.batchId,
    entityType: "bulk_import_batch",
    metadata: {
      createdDirectiveIds,
      registeredCount: createdDirectiveIds.length,
    },
  });

  return {
    createdDirectiveIds,
    message: "선택한 지시사항을 등록했습니다.",
    registeredCount: createdDirectiveIds.length,
  };
}

export async function registerReplaceDirectivesAsSession(
  session: AppSession,
  input: { batchId: string; confirmText: string },
): Promise<BulkDirectiveReplaceRegisterResult> {
  assertBulkAdmin(session);

  if (input.confirmText !== DIRECTIVE_REPLACE_CONFIRM_TEXT) {
    throw new ApiError(400, "확인 문구로 전체교체를 입력해주세요.", null, "BULK_REPLACE_CONFIRM_TEXT_INVALID");
  }

  const client = createSupabaseServerClient();
  const { data: batch, error: batchError } = await client
    .from("bulk_import_batches")
    .select("id, status, invalid_rows")
    .eq("id", input.batchId)
    .eq("type", DIRECTIVE_REPLACE_BATCH_TYPE)
    .maybeSingle<{ id: string; invalid_rows: number; status: string }>();

  if (batchError) {
    throw new ApiError(500, "전체 교체 내역을 확인하지 못했습니다.", batchError, "BULK_REPLACE_BATCH_LOAD_FAILED");
  }

  if (!batch) {
    throw new ApiError(404, "전체 교체 내역을 찾을 수 없습니다.", null, "BULK_REPLACE_BATCH_NOT_FOUND");
  }

  if (batch.status !== "PREVIEW") {
    throw new ApiError(400, "미리보기 상태의 전체 교체 내역만 등록할 수 있습니다.", null, "BULK_REPLACE_BATCH_NOT_PREVIEW");
  }

  if (batch.invalid_rows > 0) {
    throw new ApiError(400, "오류 행이 있어 전체 교체를 실행할 수 없습니다.", null, "BULK_REPLACE_HAS_INVALID_ROWS");
  }

  const { data: rows, error: rowError } = await client
    .from("bulk_import_rows")
    .select("id, batch_id, row_number, raw_data, normalized_data, valid, errors, directive_id, created_at")
    .eq("batch_id", input.batchId)
    .order("row_number", { ascending: true });

  if (rowError) {
    throw new ApiError(500, "전체 교체 행을 불러오지 못했습니다.", rowError, "BULK_REPLACE_ROWS_LOAD_FAILED");
  }

  const replaceRows = ((rows ?? []) as BulkImportRowRow[]).filter((row) => row.valid && !row.directive_id);

  if (replaceRows.length === 0) {
    throw new ApiError(400, "등록 가능한 지시사항이 없습니다.", null, "BULK_REPLACE_ROWS_REQUIRED");
  }

  const departments = await loadBulkDepartments(client);
  const archivedAt = new Date().toISOString();
  const archiveSuffix = archivedAt.replace(/\D/g, "").slice(0, 14);
  const archivedCount = await archiveActiveDirectivesForReplace(client, session, archivedAt, archiveSuffix);
  const plannedDirectiveNos = replaceRows.flatMap((row) => (row.normalized_data?.directiveNo ? [row.normalized_data.directiveNo] : []));

  await releaseDirectiveNumberConflicts(client, session, plannedDirectiveNos, archivedAt, archiveSuffix);

  const createdDirectiveIds: string[] = [];

  for (const row of replaceRows) {
    const directive = await createReplaceDirective(client, session, row, departments);
    const { error: updateRowError } = await client
      .from("bulk_import_rows")
      .update({
        directive_id: directive.id,
      })
      .eq("id", row.id)
      .is("directive_id", null);

    if (updateRowError) {
      throw new ApiError(500, "전체 교체 행의 등록 결과를 저장하지 못했습니다.", updateRowError, "BULK_REPLACE_ROW_UPDATE_FAILED");
    }

    createdDirectiveIds.push(directive.id);
  }

  const registeredAt = new Date().toISOString();
  const { error: batchUpdateError } = await client
    .from("bulk_import_batches")
    .update({
      archive_reason: DIRECTIVE_REPLACE_ARCHIVE_REASON,
      archived_directives_count: archivedCount,
      registered_at: registeredAt,
      status: "REGISTERED",
    })
    .eq("id", input.batchId);

  if (batchUpdateError) {
    throw new ApiError(500, "전체 교체 상태를 저장하지 못했습니다.", batchUpdateError, "BULK_REPLACE_BATCH_REGISTER_UPDATE_FAILED");
  }

  await recordHistory(client, {
    action: "BULK_DIRECTIVE_REPLACE_REGISTERED",
    actorId: session.userId,
    entityId: input.batchId,
    entityType: "bulk_import_batch",
    metadata: {
      archivedCount,
      createdDirectiveIds,
      registeredCount: createdDirectiveIds.length,
    },
  });

  return {
    archivedCount,
    createdDirectiveIds,
    message: "기존 지시사항을 숨기고 엑셀 지시사항을 등록했습니다.",
    registeredCount: createdDirectiveIds.length,
  };
}

export async function archiveBulkDirectivesAsSession(
  session: AppSession,
  input: { batchId?: string; directiveIds?: string[]; reason: string },
): Promise<BulkDirectiveArchiveResult> {
  assertBulkAdmin(session);

  const reason = input.reason.trim();

  if (!reason) {
    throw new ApiError(400, "비노출 사유를 입력해주세요.", null, "BULK_ARCHIVE_REASON_REQUIRED");
  }

  const client = createSupabaseServerClient();
  const directiveIds = new Set(input.directiveIds ?? []);

  if (input.batchId) {
    const { data: rows, error: rowsError } = await client
      .from("bulk_import_rows")
      .select("directive_id")
      .eq("batch_id", input.batchId)
      .not("directive_id", "is", null);

    if (rowsError) {
      throw new ApiError(500, "비노출할 등록 내역을 불러오지 못했습니다.", rowsError, "BULK_ARCHIVE_ROWS_LOAD_FAILED");
    }

    for (const row of rows ?? []) {
      if (row.directive_id) {
        directiveIds.add(row.directive_id);
      }
    }
  }

  if (directiveIds.size === 0) {
    throw new ApiError(400, "비노출할 지시사항을 찾을 수 없습니다.", null, "BULK_ARCHIVE_TARGET_REQUIRED");
  }

  const archivedAt = new Date().toISOString();
  const archivedDirectiveIds = [...directiveIds];
  const { error: archiveError } = await client
    .from("directives")
    .update({
      archive_reason: reason,
      archived_at: archivedAt,
      archived_by: session.userId,
      is_archived: true,
      updated_at: archivedAt,
    })
    .in("id", archivedDirectiveIds);

  if (archiveError) {
    throw new ApiError(500, "지시사항을 화면에서 숨기지 못했습니다.", archiveError, "BULK_DIRECTIVE_ARCHIVE_FAILED");
  }

  if (input.batchId) {
    const { error: batchError } = await client
      .from("bulk_import_batches")
      .update({
        status: "CANCELED",
      })
      .eq("id", input.batchId);

    if (batchError) {
      throw new ApiError(500, "등록 내역의 비노출 상태를 저장하지 못했습니다.", batchError, "BULK_BATCH_ARCHIVE_UPDATE_FAILED");
    }
  }

  await recordHistory(client, {
    action: "BULK_DIRECTIVES_ARCHIVED",
    actorId: session.userId,
    entityId: input.batchId ?? archivedDirectiveIds[0],
    entityType: input.batchId ? "bulk_import_batch" : "directive",
    metadata: {
      archivedAt,
      archivedDirectiveIds,
      reason,
    },
  });

  return {
    archivedCount: archivedDirectiveIds.length,
    archivedDirectiveIds,
    message: "선택한 지시사항을 화면에서 숨겼습니다.",
  };
}
