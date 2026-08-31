import { createAuthNavigation } from "@vitnode/core/tanstack/auth";

import { localeRouting } from "#/lib/i18n/shared";

/**
 * Going somewhere in this application from code, bound to this app's languages.
 *
 * One line of application, and everything else is
 * `@vitnode/core/tanstack/auth`: the two questions a user-supplied target has to
 * answer (may we send a browser there, and what does the router want to be
 * handed), the reason a redirect carries `to` rather than `href`, and the fact
 * that the same decision is made on a server and in a browser.
 *
 * What is left here is the only thing a package cannot answer - which languages
 * this installation serves, which is what decides whether `/pl/discover` is a
 * Polish page or a route called `pl`.
 *
 * `@vitnode/core/tanstack/routes` builds its own from the same factory, handed
 * the same `localeRouting`, so core's auth screens and this app's AdminCP command
 * palette navigate by one rule rather than two.
 */
export const { internalDestination, useAppNavigate } = createAuthNavigation({
  localeRouting,
});
