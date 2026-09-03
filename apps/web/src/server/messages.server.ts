import '@tanstack/react-start/server-only'
import { createIntlMessagesLoader } from '@vitnode/core/tanstack/i18n/server'

import { vitNodeServerConfig } from '#/vitnode.server.config'

export type { IntlMessages } from '@vitnode/core/tanstack/i18n/server'

/**
 * The messages one page needs, in one language - this app's loader.
 *
 * Everything about *how* messages load is core's: the source order (core, then
 * each plugin, then this app's overrides, later ones winning), the `web` scope
 * stamped on each so the API's tree in this same process cannot be served in its
 * place, the per-key fallback to the default locale, and the namespace pick that
 * keeps every plugin's AdminCP copy out of a page that renders none of it.
 *
 * What is this app's is the server config it is handed - the plugins it
 * registered, the languages it declares, and the loaders that stand in for each
 * package's own locale barrel.
 */
export const loadIntlMessages = createIntlMessagesLoader(vitNodeServerConfig)
