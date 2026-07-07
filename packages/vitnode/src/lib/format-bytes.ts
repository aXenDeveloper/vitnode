const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export const formatBytes = (bytes: number, decimals = 1): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const exponent = Math.max(
    0,
    Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1),
  );
  const value = bytes / 1024 ** exponent;
  const rounded = exponent === 0 ? value : Number(value.toFixed(decimals));

  return `${rounded} ${UNITS[exponent]}`;
};
