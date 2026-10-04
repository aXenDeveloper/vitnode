const MAX_TARGET_LENGTH = 2048;
const MAX_TEXT_LENGTH = 500;
const MAX_ERROR_LENGTH = 500;

export const safeNotificationTarget = (target: unknown): null | string => {
  if (typeof target !== "string") return null;
  if (target.length === 0 || target.length > MAX_TARGET_LENGTH) return null;
  if (!target.startsWith("/")) return null;
  if (target.startsWith("//") || target.startsWith("/\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(target)) return null;

  try {
    const base = "https://notifications.invalid";
    const url = new URL(target, base);
    if (url.origin !== base) return null;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

export const plainNotificationText = (value: unknown): string => {
  if (typeof value !== "string") return "";

  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT_LENGTH)
  );
};

export const sanitizeDeliveryError = (error: unknown): string => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  return raw
    .replace(/[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g, "[email]")
    .replace(
      /(key|token|secret|password|authorization)=[^\s&]+/gi,
      "$1=[redacted]",
    )
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_LENGTH);
};
