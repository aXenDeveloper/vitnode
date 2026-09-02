import type { Context, Next } from "hono";

/**
 * Headers for the route that serves stored uploads off disk.
 *
 * Uploads are served from the API's own origin, which is the origin the session
 * cookie belongs to. That makes any stored file the browser is willing to treat
 * as a *document* - HTML, an SVG carrying a `<script>` - a page on the site
 * rather than an attachment on it, able to read the signed-in visitor's API as
 * them. `safeStorageExtension` stops a file being written under an extension its
 * media type does not justify, and this is the other half: whatever does end up
 * stored, it does not execute in this origin.
 *
 * - `Content-Security-Policy: sandbox` drops the response into an opaque origin
 *   when it is navigated to, so script in it has no cookies, no same-origin API
 *   and no storage. It applies only to documents, so an image fetched by an
 *   `<img>` tag is completely unaffected - including an SVG, which never runs
 *   script through that path anyway.
 * - `X-Content-Type-Options: nosniff` stops the browser deciding for itself that
 *   something declared `image/png` is really HTML.
 *
 * Deliberately no `Cross-Origin-Resource-Policy`: VitNode supports the web app
 * and the API on separate origins, and `same-origin` there would blank every
 * uploaded image on the site.
 */
export const storageStaticHeadersMiddleware = () => {
  return async (c: Context, next: Next) => {
    await next();

    c.header("Content-Security-Policy", "sandbox");
    c.header("X-Content-Type-Options", "nosniff");
  };
};
