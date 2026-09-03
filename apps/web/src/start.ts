import { createVitNodeStart } from '@vitnode/core/tanstack/start'

import { vitNodeConfig } from '#/vitnode.config'

/**
 * This app's Start instance.
 *
 * The whole request pipeline is VitNode's: CSRF on server functions, canonical
 * locale redirects with the remembered-locale cookie, and the `private,
 * no-store` directive every document carrying a dehydrated session needs. Pass
 * `requestMiddleware` to add this app's own, which runs after all of it.
 */
export const startInstance = createVitNodeStart({ config: vitNodeConfig })
