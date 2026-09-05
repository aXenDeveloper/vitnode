import { createIsomorphicFn } from "@tanstack/react-start";

import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";
import type {
  UniversalFetcher,
  UniversalRawFetcher,
} from "@/lib/fetcher-client";
import type {
  FetcherParams,
  FetcherRequestOptions,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from "@/lib/fetcher/types";

import {
  clientModule,
  fetcherClient,
  rawFetcherClient,
} from "@/lib/fetcher-client";

import {
  fetcher as serverFetcher,
  rawFetcher as serverRawFetcher,
} from "./server";

export type { UniversalFetcher, UniversalRawFetcher };
export { clientModule } from "@/lib/fetcher-client";

export const fetcher = createIsomorphicFn()
  .server(serverFetcher)
  .client(fetcherClient) as UniversalFetcher;

export const rawFetcher = createIsomorphicFn()
  .server(serverRawFetcher)
  .client(rawFetcherClient) as UniversalRawFetcher;

type ApiClient<T extends BaseBuildModuleReturn> =
  T extends BuildModuleReturn<
    string,
    infer MainModule extends string,
    infer Routes extends Route[],
    infer Modules extends BaseBuildModuleReturn[]
  >
    ? {
        fetch: <
          ModuleName extends GetModulePaths<MainModule, Modules>,
          SelectedPath extends GetValidPathsForModule<
            ModuleName,
            MainModule,
            Routes,
            Modules
          >,
          Method extends GetValidMethodForPath<
            ModuleName,
            SelectedPath,
            MainModule,
            Routes,
            Modules
          > = GetValidMethodForPath<
            ModuleName,
            SelectedPath,
            MainModule,
            Routes,
            Modules
          >,
        >(
          args: FetcherParams<
            MainModule,
            Routes,
            Modules,
            ModuleName,
            SelectedPath,
            Method
          > &
            Omit<FetcherRequestOptions, "additionalHeaders" | "origin"> & {
              captchaToken?: string;
            },
        ) => Promise<
          InferResponseType<
            MainModule,
            Routes,
            Modules,
            ModuleName,
            SelectedPath,
            Method
          >
        >;
      }
    : never;

export const createApiClient = <T extends BaseBuildModuleReturn>(
  pluginId: T["pluginId"],
): ApiClient<T> =>
  ({
    fetch: fetcher.bind(null, clientModule<T>(pluginId)),
  }) as ApiClient<T>;
