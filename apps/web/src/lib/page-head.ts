import { createRouteHead } from '@vitnode/core/tanstack/metadata'

import { vitNodeConfig } from '#/vitnode.config'

export const pageHead = createRouteHead(vitNodeConfig.metadata)
