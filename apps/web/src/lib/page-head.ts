import { createRouteHead } from '@vitnode/core/tanstack/metadata'

import { vitNodeConfig } from '#/vitnode.config'

/**
 * A route's `head`, bound to this app's name.
 *
 * Two lines of application, and everything else is
 * `@vitnode/core/tanstack/metadata`: the `"<page> - <site>"` title rule Next.js
 * applies through `title.template`, the decision that a robots directive is
 * stated rather than assumed, and the handling of a `loaderData` that is
 * `undefined` on a route's first pass.
 *
 * What is left here is the only thing a package cannot answer - this site's own
 * name, which is what every tab title ends with.
 *
 *     head: ({ loaderData }) => pageHead({ robots: 'index, follow', ...loaderData })
 */
export const pageHead = createRouteHead(vitNodeConfig.metadata)
