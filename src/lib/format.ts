const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "미정";
  }

  return dateFormatter.format(new Date(value));
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatRelativeUpdate(value: string | null | undefined) {
  if (!value) {
    return "업데이트 없음";
  }

  const target = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - target) / 60000));

  if (diffMinutes < 1) {
    return "방금 업데이트";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}
