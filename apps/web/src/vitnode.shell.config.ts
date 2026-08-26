import type { VitNodeConfig } from '@vitnode/core/vitnode.config'

import { i18n } from './i18n'

/**
 * The VitNode config the browser is allowed to see.
 *
 * Everything in `VitNodeConfig` except `plugins`, and that omission is the whole
 * point. The plugin registry carries each plugin's translations as `import()`s
 * of JSON inside its `dist`, and eventually its AdminCP components - neither of
 * which a browser bundle should hold. In Next.js the boundary is drawn for you:
 * `vitnode.config.ts` is only ever read by Server Components, so none of it
 * reaches the client. TanStack Start has no such boundary - anything the root
 * route imports is in the browser bundle - so the split is made here instead, by
 * hand.
 *
 * `vitnode.config.ts` spreads this into `buildConfig` with the plugins added, so
 * there is one source for the metadata, the theme and the locales rather than
 * two that agree until they don't.
 *
 * Everything here is plain, serializable data. That is a rule, not a
 * coincidence: this module is imported by the document shell, which renders on
 * both sides of hydration.
 */
export const vitNodeShellConfig = {
  debug: false,
  i18n,
  metadata: {
    shortTitle: 'VitNode',
    title: 'VitNode',
  },
  theme: {
    defaultTheme: 'system',
  },
} satisfies Omit<VitNodeConfig, 'plugins'>
