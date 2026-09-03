import { createIsomorphicFn } from "@tanstack/react-start";

import type {
  UniversalFetcher,
  UniversalRawFetcher,
} from "@/lib/fetcher-client";

import { fetcherClient, rawFetcherClient } from "@/lib/fetcher-client";

import {
  fetcher as serverFetcher,
  rawFetcher as serverRawFetcher,
} from "./server";

export type { UniversalFetcher, UniversalRawFetcher };
export { clientModule } from "@/lib/fetcher-client";

/**
 * One typed API call, wherever a TanStack Start route runs it.
 *
 * The chain below has to stay written out here: Start's compiler rewrites
 * `createIsomorphicFn().server(x).client(y)` to `x` or `y` per environment and
 * only recognises the literal chain, so a wrapper around it would ship both
 * branches - and the server branch reaches `@tanstack/react-start/server-only`.
 *
 * The assertion is the price of that: `IsomorphicFn` collapses to
 * `(...args) => TServer | TClient`, which drops the route-literal generics that
 * are the whole point of the fetcher. Sound, because the two implementations it
 * chooses between are the two functions {@link UniversalFetcher} describes.
 */
export const fetcher = createIsomorphicFn()
  .server(serverFetcher)
  .client(fetcherClient) as UniversalFetcher;

/**
 * {@link fetcher} for a route with no TypeScript module to infer from - which
 * means the Content Engine's generated ones, and nothing else.
 *
 * Same chain, same reason it is written out here.
 */
export const rawFetcher = createIsomorphicFn()
  .server(serverRawFetcher)
  .client(rawFetcherClient) as UniversalRawFetcher;
