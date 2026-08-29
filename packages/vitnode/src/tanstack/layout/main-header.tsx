"use client";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Header } from "./header";
import { UserHeader } from "./user-header";

/**
 * The site header, as a shell's slot for it.
 *
 * Two components and no logic, which is the point: {@link Header} is the bar -
 * the logo, the nav, the language and theme switchers - and {@link UserHeader}
 * is the session-dependent half that goes in its action area. Keeping them
 * separate is what lets the bar render from the message cache alone while the
 * user area reads a query that may still be in flight.
 *
 * Both halves take the same link component, so a host mid-migration names it
 * once rather than in two places that could disagree about which application
 * serves `/settings`.
 *
 * ## What the shell owes this
 *
 * Two warm cache entries, both from its own loader:
 *
 *     headerIntlQueryOptions  ->  a `useSuspenseQuery`, so this is required
 *     prefetchSession         ->  the first paint shows the visitor, not a gap
 *
 * See each component for why one is `ensure` and the other `prefetch`.
 */
export const MainHeader = ({
  LinkComponent,
  logo,
}: {
  /** How a header path becomes a navigation, for the bar and the user menu. */
  LinkComponent?: AuthLinkComponent;
  /** The application's mark. Defaults to VitNode's. */
  logo?: React.ReactNode;
}) => (
  <Header
    LinkComponent={LinkComponent}
    logo={logo}
    user={<UserHeader LinkComponent={LinkComponent} />}
  />
);
