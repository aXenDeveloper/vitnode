/**
 * The application shell of a VitNode TanStack Start host.
 *
 * What a host composes rather than writes: the header and its user area, the
 * language switcher, and the two buttons a dead-end screen ends with. Everything
 * here is orchestration over components the Next.js applications already render,
 * so the two frameworks cannot drift into two headers.
 *
 * The pieces a host still owns are the ones only it can answer - its route tree,
 * its mark, and, while half of VitNode is served by another application, how a
 * path becomes a navigation. Each of those is a prop with a default that is
 * correct for a finished install.
 */
export { ErrorActions } from "./error-actions";
export {
  Header,
  HEADER_NAMESPACES,
  headerIntlQueryOptions,
  loadMainShell,
} from "./header";
export { LanguageSwitcher } from "./language-switcher";
export { MainHeader } from "./main-header";
export { NotFound } from "./not-found";
export { VitNodeRootProviders } from "./root-providers";
export { RouterLink } from "./router-link";
export { UserHeader } from "./user-header";

/**
 * The shell's own frame - listeners, header, breadcrumb, `<main>` - re-exported
 * so a TanStack route reaches it through this barrel rather than through
 * `views/`. It is the half of `ThemeLayout` that renders no Next.js, and the
 * Next apps keep it through `ThemeLayout` itself.
 */
export { ThemeLayoutContent } from "@/views/layouts/theme/layout-content";
