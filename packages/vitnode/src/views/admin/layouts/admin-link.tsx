import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { isExternalHref } from "./normalize-url";

/**
 * A destination that leaves the application, as a plain anchor.
 *
 * No router, no locale prefix, no route lookup - which is the entire correct
 * handling of an absolute URL and none of what a `LinkComponent` does.
 */
const ExternalLink: AuthLinkComponent = props => <a {...props} />;

/**
 * Which component renders one AdminCP destination.
 *
 * A `LinkComponent` is documented to take a *path* and turn it into a
 * navigation. A plugin's `admin.nav` entry may point at an external URL instead,
 * and every implementation of that seam mishandles one: `next-intl`'s
 * locale-aware `Link` tries to localize it, TanStack Router's `Link` tries to
 * match it against a route tree, and `apps/web`'s `MigrationLink` asks
 * `isTanStackOwnedPath`, which reads only the pathname - so
 * `https://status.example.com` arrives as `/`, matches the front page, and is
 * reported as a route this application owns. The result in all three is a
 * sidebar entry that goes somewhere other than where its author said.
 *
 * Deciding here keeps that knowledge in the one place that has external hrefs to
 * render, rather than requiring three link components to grow the same special
 * case - and it is decided identically for the sidebar and the command palette,
 * so an entry cannot behave one way when clicked and another way when searched.
 */
export const adminLinkFor = (
  href: string,
  LinkComponent: AuthLinkComponent,
): AuthLinkComponent => (isExternalHref(href) ? ExternalLink : LinkComponent);
