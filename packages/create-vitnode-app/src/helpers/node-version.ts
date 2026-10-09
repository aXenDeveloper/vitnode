export const supportedNodeRange = "^22.18.0 || ^24.11.0 || >=26.0.0";

export const supportedNodeRangeLabel = "22.18+, 24.11+ or 26+";

const minimumMinorByMajor: Record<number, number> = { 22: 18, 24: 11 };

export const isSupportedNodeVersion = (version: string) => {
  const [major = 0, minor = 0] = version
    .replace(/^v/, "")
    .split(".")
    .map(Number);

  if (major >= 26) return true;

  const minimumMinor = minimumMinorByMajor[major];

  return minimumMinor !== undefined && minor >= minimumMinor;
};
