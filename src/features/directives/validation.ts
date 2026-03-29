type DirectiveLogValidationInput = {
  actionSummary: string | null | undefined;
  attachmentCount?: number;
  detail: string | null | undefined;
  happenedAt: string | null | undefined;
  logType: string | null | undefined;
};

const bannedLogInputs = new Set([
  ".",
  "..",
  "---",
  "ㅇ",
  "test",
  "1234",
  "확인",
  "완료",
  "작업",
]);

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(value: string | null | undefined) {
  return normalizeText(value).replace(/\s+/g, "");
}

function hasOnlySymbols(value: string) {
  return value.length > 0 && /^[\p{P}\p{S}]+$/u.test(value);
}

function isRepeatedCharacter(value: string) {
  return value.length > 1 && /^(.)(\1)+$/u.test(value);
}

function isMeaninglessText(value: string) {
  const compact = compactText(value).toLowerCase();

  if (!compact) {
    return true;
  }

  if (bannedLogInputs.has(compact)) {
    return true;
  }

  if (hasOnlySymbols(compact) || isRepeatedCharacter(compact)) {
    return true;
  }

  return !/[0-9a-z가-힣]/iu.test(compact);
}

export function validateDirectiveLogActionSummary(value: string | null | undefined) {
  const trimmed = normalizeText(value);
  const compact = compactText(value);

  if (!trimmed) {
    return "로그 제목을 입력해주세요.";
  }

  if (compact.length < 2) {
    return "로그 제목을 입력해주세요.";
  }

  if (hasOnlySymbols(compact) || isRepeatedCharacter(compact) || bannedLogInputs.has(compact.toLowerCase())) {
    return "로그 제목은 공백이나 기호만 입력할 수 없습니다.";
  }

  if (!/[0-9a-z가-힣]/iu.test(compact)) {
    return "로그 제목은 공백이나 기호만 입력할 수 없습니다.";
  }

  return null;
}

export function validateDirectiveLogDetail(
  value: string | null | undefined,
  attachmentCount = 0,
) {
  const trimmed = normalizeText(value);
  const compact = compactText(value);

  if (!trimmed) {
    return attachmentCount > 0 ? null : "내용 또는 증빙 파일 중 하나는 반드시 필요합니다.";
  }

  if (compact.length < 5 || isMeaninglessText(trimmed)) {
    return "로그 내용은 5자 이상 입력해주세요.";
  }

  return null;
}

export function validateDirectiveLogSubmission(input: DirectiveLogValidationInput) {
  const actionSummaryError = validateDirectiveLogActionSummary(input.actionSummary);

  if (actionSummaryError) {
    return actionSummaryError;
  }

  if (!normalizeText(input.logType)) {
    return "로그 유형을 선택해주세요.";
  }

  if (!normalizeText(input.happenedAt)) {
    return "조치 일시를 입력해주세요.";
  }

  return validateDirectiveLogDetail(input.detail, input.attachmentCount ?? 0);
}

export function validateCompletionRequestReason(value: string | null | undefined) {
  const trimmed = normalizeText(value);
  const compact = compactText(value);

  if (!trimmed || compact.length < 5 || isMeaninglessText(trimmed)) {
    return "결과 요약을 입력해주세요.";
  }

  return null;
}
