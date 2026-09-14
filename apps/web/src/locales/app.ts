import type { AppMessagesMap } from '@vitnode/core/lib/i18n/types'

/**
 * This app's own translations, merged over whatever each package ships.
 *
 * Polish is here in full rather than in the packages: `@vitnode/core` and
 * `@vitnode/blog` ship English, and every other language an install wants is
 * the install's own. Each file is the package's web and email strings in one
 * tree, which is the shape `vitnode i18n:check` and `i18n:update` read - the
 * API registers the same file through `vitnode.api.config.ts`.
 */
export const appMessages: AppMessagesMap = {
  pl: {
    '@vitnode/blog': async () => await import('./@vitnode/blog/pl.json'),
    '@vitnode/core': async () => await import('./@vitnode/core/pl.json'),
  },
}
