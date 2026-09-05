export const normalizeUrl = (url: string): string =>
  url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;

export const isExternalHref = (href: string): boolean =>
  href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href);
