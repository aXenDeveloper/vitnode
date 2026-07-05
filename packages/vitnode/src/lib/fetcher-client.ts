import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";

import type {
  FetcherParams,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from "./fetcher/types";

import { coreFetcher } from "./fetcher/core";

/**
 * Typed reference to a server module for use with {@link fetcherClient} inside
 * client components. Import the module as a **type only** (so no server code is
 * bundled) and pass its `pluginId`; the returned stub carries just the field the
 * fetcher reads at runtime while keeping paths, methods and responses fully typed.
 *
 * @example
 * import type { myPluginModule } from "@/api/my-plugin.module";
 * const ref = clientModule<typeof myPluginModule>("@my-plugin/core");
 */
export const clientModule = <T extends BaseBuildModuleReturn>(
  pluginId: T["pluginId"],
): T => ({ pluginId }) as unknown as T;

export async function fetcherClient<
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
  Method extends GetValidMethodForPath<
    ModuleName,
    SelectedPath,
    M,
    Routes,
    Modules
  > = GetValidMethodForPath<ModuleName, SelectedPath, M, Routes, Modules>,
>(
  moduleReturn: BuildModuleReturn<string, M, Routes, Modules>,
  {
    path,
    method,
    module,
    args,
    options,
    withPagination = false,
    prefixPath = "",
    captchaToken,
    formData,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> & {
    captchaToken?: string;
    formData?: FormData;
    options?: Omit<RequestInit, "body">;
    prefixPath?: string;
    withPagination?: boolean;
  },
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  const additionalHeaders: Record<string, string> = {};

  if (captchaToken) {
    additionalHeaders["x-vitnode-captcha-token"] = captchaToken;
  }

  return await coreFetcher(moduleReturn, {
    path,
    method,
    module,
    args,
    options,
    withPagination,
    prefixPath,
    additionalHeaders,
    formData,
  });
}
