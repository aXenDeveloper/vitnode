import {
  buildContentFrontendRegistry,
  setContentFrontendRegistry,
} from '@vitnode/core/content'

import { pluginContentTypes } from '#/content-registry.gen'

/**
 * This installation's Content Engine registry - every content type its
 * configured plugins register, with their editing screens attached.
 *
 * Two lines, and both of them are host-only work by necessity. Which plugins are
 * installed is a property of this application, and `src/content-registry.gen.ts`
 * is where the build writes the answer: one literal import per configured plugin
 * that exports an `admin/content` module. Every *rule* about what a registration
 * is - which paths are legal, which two of them collide, how they are ordered,
 * how one is found by id or by `admin.path` - is `@vitnode/core`'s, in
 * `buildContentFrontendRegistry`. Nothing about the Content Engine is decided
 * here.
 *
 * ## Why it is not read from `vitnode.config.ts`
 *
 * That config is server-side on purpose (`vitnode.shell.config.ts` explains the
 * split): it carries message loaders and API wiring, which a browser bundle has
 * no business holding. The generated projection is the browser-safe half - the
 * definitions, the icons and the override components - so the AdminCP gets the
 * content screens without the server config. The same arrangement
 * `src/lib/admin-nav.ts` uses for the sidebar, one layer deeper.
 *
 * ## Registration, and where it belongs in the import graph
 *
 * `setContentFrontendRegistry` fills a module-scope slot in `@vitnode/core`, so
 * the package's own content code finds the registry without being handed it as
 * a prop - the same shape as `setAdminTransport`. Module scope means *per
 * bundle*: the browser has one instance and the server has one, and each
 * registers its own.
 *
 * This module is reached through a `() => import(...)` that `/admin/content`'s
 * loader awaits, never through a static import, and that is deliberate.
 * Registration only has to happen before a content screen runs, and deferring it
 * to the route is what lets Rollup put this whole graph - every plugin's field
 * components, table cells and form layouts, plus `zod` and the Content Engine
 * itself - in that route's chunk instead of in the bundle every page of the site
 * loads first. `router.tsx` holds the thunk because that is where the route tree
 * is composed; what it does *not* hold is the value. A plugin's own heavier
 * parts stay lazier still: `@vitnode/blog` draws a `React.lazy` boundary around
 * its Tiptap editor, so even opening the article list does not fetch it.
 */
export const contentRegistry = buildContentFrontendRegistry(pluginContentTypes)

setContentFrontendRegistry(contentRegistry)
