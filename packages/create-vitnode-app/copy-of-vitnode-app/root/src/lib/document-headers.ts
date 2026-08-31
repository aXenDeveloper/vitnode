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
 * ## It is an invariant, not a default
 *
 * This started as a fallback for documents that said nothing, and that was
 * wrong. A default is something a route may override, and at this architecture
 * level there is no override a route could correctly choose: the dehydrated
 * cache is written into the stream by `setupRouterSsrQueryIntegration` for
 * *every* document, so a route opting into `public, max-age=60` would be
 * publishing whichever visitor rendered first to everyone who asked next. The
 * route cannot know that, because the private payload is not something the route
 * put there.
 *
 * So the directive is forced rather than filled in, and a route that sets its
 * own is overwritten rather than obeyed. That is the whole difference between
 * this being a hardening measure and it being a security invariant.
 *
 * Public document caching is not forbidden forever - it is forbidden *while the
 * session is dehydrated into the document*. Introducing it later is a separate,
 * explicit piece of architecture in which the private state is kept out of the
 * shared body (a public shell fetching its session client-side, say), and the
 * invariant here would move with it rather than being quietly relaxed by a route
 * that wanted a faster page.
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
 * It deliberately does *not* ask whether a directive is already present. That
 * used to be the second half of this predicate, and it is exactly the exemption
 * the invariant above cannot afford - see {@link applyDocumentCacheControl}.
 *
 * A redirect is deliberately not matched here - it has no content type - and is
 * handled by {@link applyRedirectCacheControl} instead, which wants a narrower
 * rule.
 */
const isRenderedDocument = (headers: Headers): boolean =>
  (headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");

/**
 * Says what a rendered document is, on the response about to be sent.
 *
 * `set` rather than a conditional fill, and that is the fix: whatever the
 * response was carrying is replaced. A route cannot opt out, because a route is
 * not in a position to know what is in the body it is opting out for.
 *
 * Only `text/html` is touched. Everything else the middleware sees - the API,
 * assets, client chunks, a `204` with no content type at all - keeps whatever it
 * had, including nothing.
 *
 * Mutates rather than returning a new `Response`, because the middleware already
 * holds the one Start produced and rebuilding it would mean copying a stream.
 * The same reason `set-cookie` is appended in place a few lines away.
 */
export const applyDocumentCacheControl = (response: Response): void => {
  if (!isRenderedDocument(response.headers)) return;

  response.headers.set("cache-control", DOCUMENT_CACHE_CONTROL);
};

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
 *
 * So the cookie-carrying case is forced, for the same reason the document is: a
 * `public` directive already on such a redirect is overwritten rather than
 * respected, because the thing that makes it unsafe to share is the `Set-Cookie`
 * beside it and not whatever the directive claims.
 *
 * The cookie-less case keeps its existing semantics untouched, directive and
 * all. It carries no private state, so there is nothing here to protect and
 * nothing to override.
 */
export const applyRedirectCacheControl = (response: Response): void => {
  if (!response.headers.has("set-cookie")) return;

  response.headers.set("cache-control", DOCUMENT_CACHE_CONTROL);
};
