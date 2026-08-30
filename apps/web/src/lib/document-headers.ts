/**
 * What a VitNode document response may say about being stored.
 *
 * `private, no-store`, and it is not a precaution - it is a description of what
 * is in the body. Every page this application renders streams a dehydrated Query
 * cache into its HTML, and that cache always holds `["vitnode","session"]`: the
 * visitor's own name, avatar and `isAdmin` flag. Inside `/admin` it also holds
 * `["vitnode","admin-session"]`, which is that administrator's entire permission
 * set. `tanstack/auth/session-query` and `tanstack/admin/session-query` both say
 * so in their own words - "that document is personalised and must not be served
 * from a shared cache" - and until now nothing on the response said it back.
 *
 * Nothing caches these documents today. That is a property of the current
 * deployment, not of the application: the moment a CDN, a reverse proxy or a
 * `Cache-Control`-respecting edge sits in front of the Node server, an absent
 * directive is an invitation to store one visitor's HTML and serve it to the
 * next. Stage 15 is when that becomes likely, so the header belongs here now.
 *
 * `private` bars a shared cache. `no-store` bars every cache, including the
 * browser's own disk cache - which is the half that matters on a shared machine,
 * where the previous person's permission set should not be recoverable from
 * `chrome://cache` after they sign out. The pair is the standard spelling for
 * "this body belongs to exactly one person, once".
 *
 * The known cost is the back/forward cache. `no-store` used to make a page
 * outright ineligible for bfcache in Chromium; current versions keep such pages
 * eligible but evict them when cookies change - which for this app means a
 * sign-in or sign-out invalidates a back-navigation that would otherwise have
 * restored a page rendered for the previous session. That is the correct trade
 * and the outcome anybody would want, but it is a real difference and it is
 * worth a look during a manual pass rather than a surprise later.
 */
export const DOCUMENT_CACHE_CONTROL = 'private, no-store'

/**
 * Whether this response is one of the documents the rule above describes.
 *
 * Two questions, and the first one is what keeps the API out of it. `/api/*` is
 * served by the Hono bridge through this same middleware, and a bare `GET` from
 * it carries no `Cache-Control` of its own - so a rule that applied to every
 * response would quietly forbid clients from caching the API. An HTML
 * content-type is the honest way to ask "is this a page", it needs no path list
 * to be kept in step with the router, and it cannot be wrong about a response
 * that has already been produced.
 *
 * The second is that a route may have made its own decision. A response that
 * already carries a directive is left exactly as it is: this is a default for
 * documents that said nothing, not an override, and a page that opts into being
 * cached is a choice its own route is entitled to make.
 *
 * A redirect is deliberately *not* matched here - it has no content type - and
 * is handled by {@link applyRedirectCacheControl} instead, which wants a
 * narrower rule.
 */
const isUncachedDocument = (headers: Headers): boolean =>
  !headers.has('cache-control') &&
  (headers.get('content-type') ?? '').toLowerCase().startsWith('text/html')

/**
 * Says what a rendered document is, on the response about to be sent.
 *
 * Mutates rather than returning a new `Response`, because the middleware already
 * holds the one Start produced and rebuilding it would mean copying a stream.
 * The same reason `set-cookie` is appended in place a few lines away.
 */
export const applyDocumentCacheControl = (response: Response): void => {
  if (!isUncachedDocument(response.headers)) return

  response.headers.set('cache-control', DOCUMENT_CACHE_CONTROL)
}

/**
 * The same for a locale redirect, but only when it is carrying a cookie.
 *
 * A `308` from `/en/discover` to `/discover` is a fact about URLs, identical for
 * every visitor, and permanently cacheable - which is most of the point of
 * answering with one. So it keeps that property by default.
 *
 * The exception is the redirect that also writes the locale cookie, which is
 * what `/pl/admin` produces: a stored copy of that would hand the next visitor
 * through the same shared cache a `Set-Cookie` chosen by somebody else, and
 * quietly switch their language. Shared caches are generally expected to refuse
 * a `Set-Cookie` response, but "generally expected" is not a property this
 * application can assert about somebody else's proxy, and one visitor's cookie
 * reaching another's browser is not the kind of thing to leave to convention.
 */
export const applyRedirectCacheControl = (response: Response): void => {
  if (!response.headers.has('set-cookie')) return
  if (response.headers.has('cache-control')) return

  response.headers.set('cache-control', DOCUMENT_CACHE_CONTROL)
}
