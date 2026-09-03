/**
 * VitNode's TanStack Start request pipeline - `@vitnode/core/tanstack/start`.
 *
 * One call, in an app's `src/start.ts`:
 *
 *     import { createVitNodeStart } from '@vitnode/core/tanstack/start'
 *     import { vitNodeConfig } from './vitnode.config'
 *
 *     export const startInstance = createVitNodeStart({ config: vitNodeConfig })
 *
 * ## Why the two Start primitives are allowed here
 *
 * `boundary.test.ts` keeps `createServerFn` out of this package, because
 * uncompiled - which is how this package reaches a server - its handler silently
 * resolves to `undefined`. `createStart` and `createMiddleware` are exempt in
 * this one directory, and the reason is that neither is compiled at all: both are
 * plain builders that return the options object they were handed, and a *request*
 * middleware has only a `.server()` branch, which is the only branch a server
 * entry ever runs. The host still owns the composition - it calls this and
 * exports the result as `startInstance`, which is what the framework reads.
 *
 * ## And why nothing here is marked server-only
 *
 * `src/start.ts` is a client entry as well as a server one. See the note in
 * `locale-middleware.ts`: the browser is kept out of the request half by the
 * compiler dropping a `.server()` callback, not by a marker.
 */
export type { VitNodeStartOptions } from "./create-start";
export { createVitNodeStart } from "./create-start";
export {
  applyDocumentCacheControl,
  applyRedirectCacheControl,
  DOCUMENT_CACHE_CONTROL,
} from "./document-headers";
