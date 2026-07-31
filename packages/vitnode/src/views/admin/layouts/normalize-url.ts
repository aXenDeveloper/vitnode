export const normalizeUrl = (url: string): string =>
  url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;
