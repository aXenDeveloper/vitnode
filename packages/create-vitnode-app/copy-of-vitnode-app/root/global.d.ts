/// <reference types="use-intl" />

import core from '@vitnode/core/locales/en.json' with { type: 'json' }

/**
 * What `useTranslations` is allowed to be asked for.
 *
 * Augmenting **`use-intl`** rather than `next-intl`. `AppConfig` is declared by
 * `use-intl`, which is what VitNode renders every string through on every host;
 * `next-intl` only ever re-exported it. This is a type-level dependency and so
 * it survives a grep for imports - which is exactly why it is worth naming.
 *
 * `use-intl` has to be a *direct* dependency of this app for the reference above
 * to resolve. Under pnpm's strict `node_modules` layout, reaching it through
 * `@vitnode/core` is not enough.
 *
 * Typed against core's English tree, which is the default locale: every other
 * language falls back to it key by key, so it is the one that defines which keys
 * exist. Add a plugin's tree to the intersection to get its keys checked too:
 *
 *     import blog from '@acme/blog/locales/en.json' with { type: 'json' }
 *     Messages: typeof core & typeof blog
 */
declare module 'use-intl' {
  interface AppConfig {
    Messages: typeof core
  }
}
