const ROBOTS_HEADER = "x-robots-tag";

/** Whether a robots directive list already keeps the page out of the index. */
const saysNoIndex = (value: string): boolean =>
  value
    .split(",")
    .map(part => part.trim().toLowerCase())
    .some(part => part === "noindex" || part === "none");

export const isHtmlResponse = (response: Response): boolean =>
  (response.headers.get("content-type") ?? "")
    .toLowerCase()
    .startsWith("text/html");

/**
 * Adds `X-Robots-Tag: noindex` to an HTML response, keeping any directive it
 * already carries - a record's own `noindex, nofollow`, say. The page stays
 * crawlable, which is what lets a search engine read the directive.
 */
export const withNoIndexHeader = (response: Response): Response => {
  const existing = response.headers.get(ROBOTS_HEADER);
  if (existing !== null && saysNoIndex(existing)) return response;

  const headers = new Headers(response.headers);
  headers.append(ROBOTS_HEADER, "noindex");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const ROBOTS_META = '<meta name="robots" content="noindex"/>';

/**
 * Writes a robots `noindex` meta tag into a document, right after `<head>`.
 * For prerendered pages, which a host serves as static files without the
 * server that would add `X-Robots-Tag`. Other robots tags stay: a crawler
 * applies the most restrictive one.
 */
export const injectNoIndexMeta = (html: string): string => {
  if (html.includes(ROBOTS_META)) return html;

  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (!head) return html;
  const at = head.index + head[0].length;

  return `${html.slice(0, at)}${ROBOTS_META}${html.slice(at)}`;
};

/** {@link withNoIndexHeader} plus {@link injectNoIndexMeta}, for a prerender. */
export const withNoIndexDocument = async (
  response: Response,
): Promise<Response> => {
  const headers = new Headers(response.headers);
  const existing = headers.get(ROBOTS_HEADER);
  if (existing === null || !saysNoIndex(existing)) {
    headers.append(ROBOTS_HEADER, "noindex");
  }
  headers.delete("content-length");
  const html = injectNoIndexMeta(await response.text());

  return new Response(html, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};
