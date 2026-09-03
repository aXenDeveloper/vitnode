import { buildConfig } from "@vitnode/core/vitnode.config";

/**
 * This app's configuration - the one file every VitNode app edits first.
 *
 * **Browser-safe, and everything here has to stay that way.** Three very
 * different readers depend on it: `routes/__root.tsx` renders the document shell
 * from `metadata`, `theme` and `debug`; `lib/i18n/runtime.ts` derives the locale
 * routing from `i18n`; and Vite's own plugin registry loads this file with
 * `jiti` while it is still resolving its config, to find out which plugins to
 * generate route, navigation and content-registry imports for. So it is plain
 * data and plugin *identity* - never a `() => import(...)` message loader, never
 * a module that reaches a database. Anything like that goes in
 * `vitnode.server.config.ts`.
 *
 * ## Adding a language
 *
 * Add an entry to `locales`. Packages ship their own translations, so a new
 * locale needs nothing else: anything a package has not translated falls back to
 * `defaultLocale` key by key. Register the package's file for that language in
 * `src/locales/packages.ts`, and put your own rewording in
 * `src/locales/app.ts` - both of which `vitnode.server.config.ts` picks up.
 *
 * `vitnode i18n:create de Deutsch` does all of it for you.
 *
 * ## Adding a plugin
 *
 * With the plugin's own factory:
 *
 *     import { blogPlugin } from '@acme/blog/config'
 *
 *     plugins: [blogPlugin()]
 *
 * That is the whole registration - the factory carries the plugin's content
 * types, its AdminCP navigation and its translations. Register its locale files
 * in `src/locales/packages.ts` as well, which is what the message loader
 * actually reads.
 *
 * What the AdminCP renders comes back through `src/admin-nav.gen.ts` and
 * `src/content-registry.gen.ts` rather than out of this object: the build writes
 * one literal import per configured plugin, and `src/router.tsx` loads the
 * content registry behind a dynamic `import()`, so a content type's editing
 * screen arrives with the route that renders it.
 *
 * A plugin's *pages* need nothing in this file at all. It declares them in its
 * own `src/routes.ts`, and this app's Vite build compiles them into
 * `src/plugin-routes.gen.ts`, which `src/router.tsx` mounts under the shell the
 * plugin's `area` names. No page is ever copied into `src/routes`.
 *
 * `buildConfig` also registers this object process-wide, which is how core's own
 * route files find it without being handed it as a prop.
 */
export const vitNodeConfig = buildConfig({
  debug: false,
  i18n: {
    defaultLocale: "en",
    locales: [{ code: "en", name: "English" }],
    /**
     * Explicit, because the app renders on a server: without one, `use-intl`
     * formats dates in whatever zone the server happens to run in and warns
     * that the client will disagree.
     */
    timeZone: "UTC",
  },
  metadata: {
    shortTitle: "VitNode",
    title: "VitNode",
  },
  plugins: [],
  theme: {
    defaultTheme: "system",
  },
});
