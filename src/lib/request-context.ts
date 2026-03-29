export type RequestClientContext = {
  deviceType: string | null;
  ipAddress: string | null;
  platform: string | null;
  userAgent: string | null;
};

function readHeaderValue(headers: Headers, name: string) {
  const value = headers.get(name)?.trim();
  return value && value.length > 0 ? value : null;
}

function detectDeviceType(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  const normalized = userAgent.toLowerCase();

  if (normalized.includes("ipad") || normalized.includes("tablet")) {
    return "태블릿";
  }

  if (
    normalized.includes("mobi") ||
    normalized.includes("iphone") ||
    normalized.includes("android")
  ) {
    return "모바일";
  }

  return "데스크톱";
}

function detectPlatform(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  const normalized = userAgent.toLowerCase();

  if (normalized.includes("android")) {
    return "안드로이드";
  }

  if (normalized.includes("iphone") || normalized.includes("ipad") || normalized.includes("ios")) {
    return "iOS";
  }

  if (normalized.includes("windows")) {
    return "윈도우";
  }

  if (normalized.includes("mac os") || normalized.includes("macintosh")) {
    return "맥";
  }

  if (normalized.includes("linux")) {
    return "리눅스";
  }

  return "기타";
}

export function readRequestClientContext(source: Headers | Request): RequestClientContext {
  const headers = source instanceof Request ? source.headers : source;
  const forwardedFor = readHeaderValue(headers, "x-forwarded-for");
  const realIp = readHeaderValue(headers, "x-real-ip");
  const userAgent = readHeaderValue(headers, "user-agent");

  return {
    deviceType: detectDeviceType(userAgent),
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? realIp,
    platform: detectPlatform(userAgent),
    userAgent,
  };
}
