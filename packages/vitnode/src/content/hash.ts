/**
 * FNV-1a, 32 bits, base36. Deterministic across processes and Node versions,
 * needs no dependency, and is short enough to leave a readable prefix intact.
 */
export const fingerprint = (value: string): string => {
  let hash = 0x811c9dc5;

  for (let position = 0; position < value.length; position += 1) {
    hash ^= value.charCodeAt(position);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
};

export const clampWithFingerprint = (
  value: string,
  maxLength: number,
): string => {
  if (value.length <= maxLength) return value;

  const suffix = `_${fingerprint(value)}`;

  return `${value.slice(0, maxLength - suffix.length)}${suffix}`;
};
