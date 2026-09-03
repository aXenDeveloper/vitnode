import '@tanstack/react-start/server-only'
import { buildServerConfig } from '@vitnode/core/vitnode.config'

import { appMessages } from '#/locales/app'
import { packageMessages } from '#/locales/packages'
import { vitNodeConfig } from '#/vitnode.config'

export const vitNodeServerConfig = buildServerConfig({
  config: vitNodeConfig,
  messages: appMessages,
  packageMessages,
})
