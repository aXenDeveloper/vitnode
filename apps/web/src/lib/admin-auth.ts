import { createServerFn } from '@tanstack/react-start'
import { setAdminTransport } from '@vitnode/core/tanstack/admin'
import { readAdminSessionOnApi } from '@vitnode/core/tanstack/admin/server'

export const readAdminSessionFn = createServerFn().handler(
  async () => await readAdminSessionOnApi(),
)

setAdminTransport({
  readAdminSession: async () => await readAdminSessionFn(),
})
