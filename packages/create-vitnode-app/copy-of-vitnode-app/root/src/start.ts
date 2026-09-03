import { createVitNodeStart } from "@vitnode/core/tanstack/start";

import { vitNodeConfig } from "#/vitnode.config";

/**
 * This app's Start instance.
 *
 * The whole request pipeline is VitNode's, and it is mandatory rather than a
 * default: CSRF protection on server functions, canonical locale redirects with
 * the remembered-locale cookie, and the `private, no-store` directive every
 * document carrying a dehydrated session needs.
 *
 * Add this app's own request middleware - a request id, a tracing span, a
 * maintenance gate - with `requestMiddleware`. It runs after all of the above,
 * which is the only safe place for it: a redirect ends the request, so anything
 * in front of the locale rule would run twice for every visitor arriving at a
 * non-canonical URL.
 *
 *     export const startInstance = createVitNodeStart({
 *       config: vitNodeConfig,
 *       requestMiddleware: [myMiddleware],
 *     })
 */
export const startInstance = createVitNodeStart({ config: vitNodeConfig });
