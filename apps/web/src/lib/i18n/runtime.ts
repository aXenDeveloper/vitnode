import { createServerFn } from '@tanstack/react-start'
import { configureIntl, validateIntlInput } from '@vitnode/core/tanstack/i18n'
import { IntlProvider } from 'use-intl'

import { loadIntlMessages } from '#/server/messages.server'
import { vitNodeConfig } from '#/vitnode.config'

export const getIntlMessages = createServerFn()
  .validator(validateIntlInput)
  .handler(async ({ data }) => await loadIntlMessages(data))

export const {
  defaultLocale,
  isLocale: isSupportedLocale,
  localeRouting,
} = configureIntl({
  fetchMessages: async (input) => await getIntlMessages({ data: input }),

  hostIntlProvider: IntlProvider,
  i18n: vitNodeConfig.i18n,
})

export { createLocaleRewrite } from '@vitnode/core/tanstack/i18n'
