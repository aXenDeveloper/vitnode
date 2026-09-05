import { createAuthNavigation } from '@vitnode/core/tanstack/auth'

import { localeRouting } from '#/lib/i18n/shared'

export const { internalDestination, useAppNavigate } = createAuthNavigation({
  localeRouting,
})
