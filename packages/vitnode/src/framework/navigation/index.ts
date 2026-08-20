export {
  getPathname,
  Link,
  notFound,
  redirect,
  UnlocalizedLink,
  unlocalizedPermanentRedirect,
  usePathname,
  useRouter,
  useSearchParams,
} from "./next";

/**
 * VitNode's navigation surface.
 *
 * Import navigation from here (or from the `@/lib/navigation` shim that has
 * always pointed at the locale-aware half of it) rather than from `next/*`.
 * Everything below is re-exported from the active adapter with the adapter's
 * own inferred types intact, so nothing is lost at the call site; `./types`
 * describes the narrower contract a second adapter would have to satisfy.
 *
 * Swapping frameworks is one edit: repoint the `from "./next"` line.
 *
 * No runtime registry, unlike its `framework/cache` and `framework/request`
 * siblings, and the difference is not an oversight. Most of what navigation
 * exports is a React component or a hook, read during render and across the
 * server/client boundary - putting `Link` behind a `getAdapter()` lookup means a
 * wrapper component on every link in the product, and an installation order that
 * has to be right before the first render rather than before the first call.
 * A static re-export costs nothing, keeps the adapter's own types at the call
 * site, and leaves exactly one line to change.
 */
export type {
  NavigationAdapter,
  NavigationHref,
  NavigationLink,
  NavigationLinkProps,
  NavigationQueryParams,
  NavigationRedirectType,
  NavigationRouter,
  NavigationSearchParams,
} from "./types";
