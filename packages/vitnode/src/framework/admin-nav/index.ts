/**
 * The build-time projection of an app's AdminCP navigation -
 * `@vitnode/core/framework/admin-nav`.
 *
 * Pure, like its sibling `framework/plugin-routes`: resolved modules in, a
 * source string out. There is no `node:fs` and no package resolution here - the
 * build tool that owns those (`@vitnode/core/framework/vite`) reads the app's
 * config, asks which configured plugins export an `admin/nav` module, and writes
 * what this returns.
 *
 * ## Why a projection exists at all
 *
 * The AdminCP sidebar is a function of the plugins an installation configured,
 * and in a Next.js app that is free: `vitnode.config.ts` is only ever read by
 * Server Components, so the whole plugin registry - editing screens included -
 * can be walked in the render pass that draws the sidebar. A TanStack Start
 * application has no such boundary: anything the root route imports is in the
 * browser bundle, and the registry it would have to import carries every content
 * type's editing screen - an editor field, a form layout, a table cell - none of
 * which a sidebar needs.
 *
 * So the two are separated by what they carry rather than by a build flag, and
 * the generated file names the browser-safe half:
 *
 *     vitnode.config.ts        the plugins, server-side
 *     admin-nav.gen.ts         one literal import per plugin that has navigation
 *     AdminNavPluginSource     ids, hrefs, permissions, icons, content definitions
 *     adminNavBundle(...)      the declarations, and the strings they need
 *
 * Nothing is copied and nothing is serialised: the declarations stay compiled in
 * the plugin's own `dist` and arrive through a specifier a bundler resolved,
 * which is the same arrangement the plugin route registry uses.
 */
export { generateAdminNavSource } from "./generate.js";
export type { ResolvedAdminNavModule } from "./types.js";
