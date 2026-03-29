type HeaderReader = {
  get(name: string): string | null;
};

export type RequestClientContext = {
  deviceType: string | null;
  ipAddress: string | null;
  platform: string | null;
  userAgent: string | null;
};

function readHeaderValue(headers: HeaderReader, key: string) {
  const value = headers.get(key)?.trim();
  return value && value.length > 0 ? value : null;
}

function detectDeviceType(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  const normalized = userAgent.toLowerCase();

  if (normalized.includes("ipad") || normalized.includes("tablet")) {
    return "TABLET";
  }

  if (
    normalized.includes("mobile") ||
    normalized.includes("iphone") ||
    normalized.includes("android")
  ) {
    return "MOBILE";
  }

  return "DESKTOP";
}

function detectPlatform(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  const normalized = userAgent.toLowerCase();

  if (normalized.includes("windows")) {
    return "WINDOWS";
  }

  if (normalized.includes("iphone") || normalized.includes("ipad") || normalized.includes("ios")) {
    return "IOS";
  }

  if (normalized.includes("android")) {
    return "ANDROID";
  }

  if (normalized.includes("mac os") || normalized.includes("macintosh")) {
    return "MAC";
  }

  if (normalized.includes("linux")) {
    return "LINUX";
  }

  return "OTHER";
}

function readForwardedIp(headers: HeaderReader) {
  const forwardedFor = readHeaderValue(headers, "x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    readHeaderValue(headers, "x-real-ip") ??
    readHeaderValue(headers, "cf-connecting-ip") ??
    null
  );
}

export function readRequestClientContext(source: HeaderReader | Request): RequestClientContext {
  const headers = source instanceof Request ? source.headers : source;
  const userAgent = readHeaderValue(headers, "user-agent");

  return {
    deviceType: detectDeviceType(userAgent),
    ipAddress: readForwardedIp(headers),
    platform: detectPlatform(userAgent),
    userAgent,
  };
}
