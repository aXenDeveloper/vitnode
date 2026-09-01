export { SettingsLayoutContent } from "./layout";
/**
 * `@vitnode/core/tanstack/settings` - the settings frame, its panels, and the
 * loader every one of them shares.
 *
 * Two halves, and the split is the same one every VitNode screen namespace
 * makes:
 *
 *     ./route   the eager half - the namespace list, the message query, the
 *               panel loader and the title rule. A route file's `loader`,
 *               `head` and `staticData` import from here, and a route file is
 *               evaluated in the client entry.
 *     ./layout  the frame, and below it the panels - reached only through a
 *               route's `component:`, which is code-split.
 *
 * Everything is re-exported here, so a host that renders a settings screen of
 * its own has one specifier to import. What a *route* must not do is reach for
 * this barrel from its loader: `./layout`, `OverviewSettings` and
 * `SecuritySettings` are components, and importing them beside the loader is
 * what puts the whole settings subtree in the entry chunk of every page of the
 * application. `../eager-graph.test.ts` holds the core routes to that.
 */
export * from "./route";
export type { SettingsNavKey } from "./route";
/**
 * The panel bodies, re-exported so a route never has to reach past this
 * namespace to find one.
 *
 * They are the same modules the Next.js pages render and they contain no
 * TanStack at all, so a host *could* import them from `@vitnode/core/views/...`
 * directly - and two of its route files did. That is one feature with two entry
 * spellings, and only one of them is a spelling `boundary.test.ts` and
 * `package-boundary.test.ts` can police: a deep `views/` path resolves through
 * the package-wide `./*` pattern, where nothing checks what a route is allowed
 * to reach for. Re-exporting them here makes `@vitnode/core/tanstack/settings`
 * the whole of what a settings route imports.
 *
 * `DevicesPanelContent` is deliberately not among them - it owns a query, so it
 * lives in `@vitnode/core/tanstack/devices` beside the query options its route's
 * loader has to warm.
 */
export { OverviewSettings } from "@/views/auth/settings/overview/overview";
export { SecuritySettings } from "@/views/auth/settings/security/security";
/**
 * The settings trail. A host binds its own link component to it - during a
 * migration that is not a plain `<Link>` - and mounts the result as the
 * subtree's `staticData.breadcrumb`.
 */
export type { SettingsBreadcrumbContentProps } from "@/views/auth/settings/settings-breadcrumb-content";
export { SettingsBreadcrumbContent } from "@/views/auth/settings/settings-breadcrumb-content";
export {
  activeSettingsNavKey,
  isSettingsNavItemActive,
  isSettingsRootPath,
  SETTINGS_NAV_ITEMS,
  SETTINGS_ROOT_HREF,
  settingsNavHref,
} from "@/views/auth/settings/settings-nav";
