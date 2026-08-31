/**
 * The main header's links, as data.
 *
 * Two routes today - Discover and Search - and the reason they are a list rather
 * than two hard-coded `<Link>`s is that the header is now rendered by two
 * frameworks. Both have to agree on *where* the nav points and *what order* it
 * is in; only the component that turns an href into a navigation differs. So the
 * destinations live here, the labels are resolved by whoever has a translator,
 * and {@link headerNavItems} puts the two together in one place.
 *
 * This is deliberately not a navigation framework and not a route registry.
 * There is no active-state resolution, no nesting and no permissions here: the
 * header renders the same two links it always has, and a plugin that wants a
 * third one is a design question this stage does not answer.
 */

/**
 * The anchor a header link ends up rendering.
 *
 * Every prop of one, not just `href`: a caller may hand the logo link a class
 * name, and the nav links get `buttonVariants(...)`. The same shape
 * `AuthLinkProps` and `HeaderContentBackLinkProps` already use, for the same
 * reason - a wrapper that accepted only `href` would silently drop the rest.
 */
export interface HeaderLinkProps extends Omit<
  React.ComponentProps<"a">,
  "href"
> {
  href: string;
}

/**
 * The one thing the header cannot decide for itself.
 *
 * Turning `/discover` into a client-side navigation is the single question whose
 * answer differs between the two frameworks: Next.js wants `next-intl`'s
 * locale-aware `Link` (`@/lib/navigation`), TanStack Start wants the router's own
 * - and TanStack Start wants the router's own (`RouterLink`). Both are a component
 * taking {@link HeaderLinkProps}, so the header takes one and stops caring - and
 * importing neither is what lets a TanStack Start route render it.
 */
export type HeaderLinkComponent = (props: HeaderLinkProps) => React.ReactNode;

/** Where the main header points. Internal paths, with no locale prefix in them. */
export const HEADER_HREF = {
  discover: "/discover",
  home: "/",
  search: "/search",
} as const;

/**
 * The keys the labels come from, under `core.search`.
 *
 * Named here so the two wrappers cannot spell them differently, and left as
 * literals (`as const`) so a typed translator still checks them at the call
 * site - which is why the *keys* are shared and the translator is not. Next.js
 * resolves them on the server with `getTranslations`, TanStack Start in the
 * browser with `useTranslations`; the two translator types are not
 * interchangeable, and passing one through a shared signature would mean giving
 * up key checking in both.
 */
export const HEADER_NAV_MESSAGE_KEYS = {
  discover: "nav.discover",
  search: "nav.search",
} as const;

/** One link in the main nav. */
export interface HeaderNavItem {
  href: string;
  label: string;
}

/** The labels {@link headerNavItems} needs, already translated. */
export interface HeaderNavLabels {
  discover: string;
  search: string;
}

/**
 * The main nav, in the order it renders.
 *
 * Pure, and the only place that pairs a destination with its label - so the two
 * frameworks cannot drift into a different set of links or a different order.
 */
export const headerNavItems = ({
  discover,
  search,
}: HeaderNavLabels): HeaderNavItem[] => [
  { href: HEADER_HREF.discover, label: discover },
  { href: HEADER_HREF.search, label: search },
];
