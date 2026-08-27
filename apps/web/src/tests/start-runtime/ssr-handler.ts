import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

/**
 * The real thing: TanStack Start's request handler over this app's real route
 * tree, rendering React.
 *
 * `handler.ts` next to this one replaces the render with a marker string, which
 * is what the routing tests want - a response that came from the router is then
 * identifiable. This one does not: `defaultStreamHandler` is the callback the
 * built server uses, so what comes back is the HTML a browser would receive,
 * `<html lang>` and all. The two things a test cannot have are still replaced:
 * the built asset manifest and the Vite client entry.
 */
export const ssrHandler = createStartHandler(defaultStreamHandler)

/** The rendered document for one request, as a string. */
export const renderPage = async (
  input: RequestInfo,
  init?: RequestInit,
): Promise<{ headers: Headers; html: string; status: number }> => {
  const response = await ssrHandler(new Request(input, init))

  return {
    headers: response.headers,
    html: await response.text(),
    status: response.status,
  }
}
