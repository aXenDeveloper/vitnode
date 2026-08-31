/**
 * The build-time projection of an app's Content Engine frontend registrations -
 * `@vitnode/core/framework/content-registry`.
 *
 * Pure, like its siblings `framework/admin-nav` and `framework/plugin-routes`:
 * resolved modules in, a source string out. There is no `node:fs` and no package
 * resolution here - the build tool that owns those
 * (`@vitnode/core/framework/vite`) reads the app's config, asks which configured
 * plugins export an `admin/content` module, and writes what this returns.
 *
 * ## Why a projection exists at all
 *
 * The AdminCP's content screens are a function of the plugins an installation
 * configured, and in a Next.js app that is free: `vitnode.config.ts` is only
 * ever read by Server Components, so the whole plugin registry - editing screens
 * included - can be walked in the render pass. A TanStack Start application has
 * no such boundary; anything the router imports is in a bundle.
 *
 * So the layers are separated by what they carry, and the generated files name
 * each browser-safe half:
 *
 *     vitnode.config.ts          the plugins, server-side
 *     admin-nav.gen.ts           ids, hrefs, permissions, icons, definitions
 *     content-registry.gen.ts    the above, plus field/column/layout overrides
 *     ContentFrontendPluginSource the type both a plugin and the app agree on
 *
 * ## Why it is not JSON
 *
 * A navigation entry is a string and an icon element. A content registration is
 * a *React component per override* - a Tiptap field, a colour cell, a two-column
 * form layout - which cannot be serialised and must not be reached through a
 * specifier built from a plugin id. So the generated file is a module of literal
 * imports, and the components stay compiled in the plugin's own `dist`, which is
 * the same arrangement the plugin route registry uses.
 */
export { generateContentRegistrySource } from "./generate.js";
export type { ResolvedContentRegistryModule } from "./types.js";
