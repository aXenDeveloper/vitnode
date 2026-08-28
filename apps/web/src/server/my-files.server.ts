import '@tanstack/react-start/server-only'
import type {
  MyFilesPageFetcher,
  MyFilesParams,
} from '@vitnode/core/views/files/my-files-query'

import {
  myFilesRequest,
  MyFilesRequestError,
  userFilesModuleRef,
} from '@vitnode/core/views/files/my-files-query'

import { fetcherServer } from '#/server/fetcher.server'

/**
 * One page of the visitor's own files, fetched during SSR.
 *
 * The request and the refusal check are core's - the same two the browser
 * fetcher uses - so a page rendered on the server and a page fetched after
 * hydration are the same request with the same failure semantics. Only the
 * *transport* is this module's, and it is the only part that genuinely cannot be
 * shared.
 *
 * `fetcherServer` rather than a bare `fetch`, and here that is not a nicety: the
 * list is per-visitor and the API decides whose it is from the `Cookie` header.
 * A render that forwarded nothing would be answered as an anonymous visitor -
 * `401` - so this is the difference between a signed-in page and an error. It
 * also resolves the API origin from the request being rendered, so a preview
 * deployment calls its own hostname rather than a configured one.
 *
 * Only ever reached through the isomorphic transport in `#/lib/files/my-files`,
 * which is what keeps this module - and the `server-only` marker above it - out
 * of the browser bundle.
 */
export const fetchMyFilesPageOnServer: MyFilesPageFetcher = async (
  params: MyFilesParams,
) => {
  const response = await fetcherServer(
    userFilesModuleRef,
    myFilesRequest(params),
  )

  if (!response.ok) throw new MyFilesRequestError(response.status, params)

  return await response.json()
}
