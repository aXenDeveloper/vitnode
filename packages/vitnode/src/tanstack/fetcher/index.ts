import { createIsomorphicFn } from "@tanstack/react-start";

import type {
  FetcherClientOptions,
  UniversalFetcher,
  UniversalRawFetcher,
} from "@/lib/fetcher-client";

import { fetcherClient, rawFetcherClient } from "@/lib/fetcher-client";

import {
  fetcher as serverFetcher,
  rawFetcher as serverRawFetcher,
} from "./server";

export type { FetcherClientOptions, UniversalFetcher, UniversalRawFetcher };
export type { ApiEndpoint, ApiPluginContract } from "@/lib/fetcher/contract";
export type { ApiPluginRegistry } from "@/lib/fetcher/registry";
export type {
  AllEndpoints,
  ApiRequest,
  PluginEndpoints,
  PluginModulePath,
  PluginRouteMethod,
  PluginRoutePath,
  RegisteredPluginId,
  ResponseFor,
} from "@/lib/fetcher/types";

type IsomorphicFetcher = (request: never) => Promise<Response>;

export const fetcher = createIsomorphicFn()
  .server(serverFetcher as IsomorphicFetcher)
  .client(fetcherClient) as UniversalFetcher;

export const rawFetcher = createIsomorphicFn()
  .server(serverRawFetcher)
  .client(rawFetcherClient) as UniversalRawFetcher;
