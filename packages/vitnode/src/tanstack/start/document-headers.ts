/**
 * What a VitNode document response may say about being stored.
 *
 * `private, no-store` is a description of the body rather than a precaution.
 * Every page a VitNode app renders streams a dehydrated Query cache into its
 * HTML, and that cache always holds `["vitnode","session"]` - the visitor's own
 * name, avatar and `isAdmin` flag. Inside `/admin` it also holds
 * `["vitnode","admin-session"]`, which is that administrator's entire permission
 * set.
 *
 * ## It is an invariant, not a default
 *
 * A default is something a route may override, and there is no override a route
 * could correctly choose here: the dehydrated cache is written into the stream
 * by `setupRouterSsrQueryIntegration` for *every* document, so a route opting
 * into `public, max-age=60` would publish whichever visitor rendered first to
 * everyone who asked next. The route cannot know that, because the private
 * payload is not something the route put there. So the directive is forced, and
 * a route that sets its own is overwritten rather than obeyed.
 *
 * Public document caching is not forbidden forever - it is forbidden *while the
 * session is dehydrated into the document*. Introducing it later is a separate
 * piece of architecture in which the private state is kept out of the shared
 * body, and this invariant moves with it rather than being quietly relaxed.
 *
 * `private` bars a shared cache; `no-store` bars every cache, the browser's own
 * disk cache included - which is the half that matters on a shared machine,
 * where the previous person's permission set should not be recoverable after
 * they sign out. The known cost is the back/forward cache: Chromium keeps such
 * pages eligible but evicts them when cookies change, so signing in or out
 * invalidates a back-navigation that would have restored a page rendered for the
 * previous session.
 */
export const DOCUMENT_CACHE_CONTROL = "private, no-store";

/**
 * Whether this response is one of the documents the rule above describes.
 *
 * One question, and it is what keeps the API out of it. `/api/*` is served by
 * the Hono bridge through this same middleware, and a bare `GET` from it carries
 * no `Cache-Control` of its own - so a rule that applied to every response would
 * quietly forbid clients from caching the API. An HTML content-type is the
 * honest way to ask "is this a page", it needs no path list to be kept in step
 * with the router, and it cannot be wrong about a response that has already been
 * produced.
 *
 * It deliberately does *not* ask whether a directive is already present, which
 * is exactly the exemption the invariant cannot afford. A redirect is not
 * matched here either - it has no content type - and is handled by
 * {@link applyRedirectCacheControl} instead.
 *
 * The one HTML page the API does serve - Swagger UI at `/api/swagger` - is
 * therefore covered, which is correct rather than an edge case: it is a document
 * an operator reads, not a response a client caches, and nothing about the JSON
 * routes beside it is touched.
 */
const isRenderedDocument = (headers: Headers): boolean =>
  (headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");

/**
 * Says what a rendered document is, on the response about to be sent.
 *
 * Mutates rather than returning a new `Response`, because the middleware already
 * holds the one Start produced and rebuilding it would mean copying a stream.
 * Everything that is not `text/html` - the API, assets, client chunks, a `204`
 * with no content type at all - keeps whatever it had, including nothing.
 */
export const applyDocumentCacheControl = (response: Response): void => {
  if (!isRenderedDocument(response.headers)) return;

  response.headers.set("cache-control", DOCUMENT_CACHE_CONTROL);
};

/**
 * The same for a locale redirect, but only when it is carrying a cookie.
 *
 * A `308` from `/en/discover` to `/discover` is a fact about URLs, identical for
 * every visitor and permanently cacheable - which is most of the point of
 * answering with one, so it keeps that property.
 *
 * The exception is the redirect that also writes the locale cookie, which is
 * what `/pl/admin` produces: a stored copy would hand the next visitor through
 * the same shared cache a `Set-Cookie` chosen by somebody else and quietly
 * switch their language. Shared caches are generally expected to refuse a
 * `Set-Cookie` response, but that is not a property this application can assert
 * about somebody else's proxy.
 */
export const applyRedirectCacheControl = (response: Response): void => {
  if (!response.headers.has("set-cookie")) return;

  response.headers.set("cache-control", DOCUMENT_CACHE_CONTROL);
};
