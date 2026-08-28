/**
 * The one thing the auth screens cannot decide for themselves.
 *
 * Every link on the login card points somewhere VitNode owns - `/register`,
 * `/login/reset-password`, `/login` - and turning one of those paths into a
 * navigation is the single question whose answer differs between the two
 * frameworks: Next.js wants `next-intl`'s locale-aware `Link`
 * (`@/lib/navigation`), TanStack Start wants the router's own, and during the
 * migration it wants one that decides per href whether this app can render the
 * destination at all. Both are a component taking {@link AuthLinkProps}, so the
 * shared views take one and stop caring - and importing neither is what lets a
 * TanStack Start route render the login card.
 *
 * The same boundary `SearchFeedContent` and `HeaderContent` already draw, for
 * the same reason.
 */

/**
 * The anchor a shared auth link ends up rendering.
 *
 * Every prop of one, not just `href`: `SSOCallbackContent` puts a link inside a
 * Base UI `render`, which clones the element with the children, the class name
 * and the ref it needs to stay a button. A wrapper that accepted only `href`
 * would drop all three, so the type says so.
 */
export interface AuthLinkProps extends Omit<React.ComponentProps<"a">, "href"> {
  href: string;
}

export type AuthLinkComponent = (props: AuthLinkProps) => React.ReactNode;

/**
 * Where the auth screens link to by default.
 *
 * Ordinary data rather than a route table: a caller that mounts the login card
 * somewhere else overrides the one href it moved, and nothing here has to know
 * about it.
 *
 * Nothing here records which application serves any of them either, and that is
 * the point rather than an omission. All three were Next.js pages when this was
 * written and all three are TanStack Start routes now; in that app they are
 * reached through the migration link, which asks the route tree per href, so the
 * change was route files and no edit to this record.
 */
export const AUTH_HREF = {
  resetPassword: "/login/reset-password",
  signIn: "/login",
  signUp: "/register",
} as const;
