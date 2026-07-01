import type { RouteConfig } from "@hono/zod-openapi";
import type { ResponseFormat } from "hono/types";
import type { StatusCode, SuccessStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

import type { BaseBuildModuleReturn } from "@/api/lib/module";
import type { Route } from "@/api/lib/route";

interface ClientResponse<
  T,
  U extends number = StatusCode,
  F extends ResponseFormat = ResponseFormat,
>
  extends globalThis.Response {
  arrayBuffer: () => Promise<ArrayBuffer>;
  blob: () => Promise<Blob>;
  readonly body: null | ReadableStream;
  readonly bodyUsed: boolean;
  clone: () => Response;
  formData: () => Promise<FormData>;
  headers: Headers;
  json: () => F extends "text/html" | "text/plain"
    ? Promise<never>
    : F extends "application/json"
      ? Promise<T>
      : Promise<unknown>;
  ok: U extends SuccessStatusCode
    ? true
    : U extends Exclude<StatusCode, SuccessStatusCode>
      ? false
      : boolean;
  redirect: (url: string, status: number) => Response;
  status: U;
  statusText: string;
  text: () => F extends "text/html" | "text/plain"
    ? T extends string
      ? Promise<T>
      : Promise<never>
    : Promise<string>;
  url: string;
}

interface RouteShape {
  readonly route: {
    readonly method: string;
    readonly path: string;
  };
}

interface ModuleSpec {
  readonly modules?: readonly ModuleSpec[];
  readonly name: string;
  readonly routes: readonly RouteShape[];
}

type SplitPath<S extends string> = S extends `${infer First}/${infer Rest}`
  ? [First, ...SplitPath<Rest>]
  : S extends ""
    ? []
    : [S];

type FindModuleNested<
  M extends { modules?: readonly ModuleSpec[] },
  Path extends string[],
> = Path extends [infer First extends string, ...infer Rest extends string[]]
  ? Extract<M["modules"], readonly ModuleSpec[]>[number] extends infer SubModule
    ? SubModule extends ModuleSpec & { name: First }
      ? Rest["length"] extends 0
        ? SubModule
        : FindModuleNested<SubModule, Rest>
      : never
    : never
  : M;

type GetTargetModule<
  ModulePath extends string,
  MainModuleName extends string,
  MainRoutes extends readonly RouteShape[],
  SubModules extends readonly ModuleSpec[],
> = ModulePath extends MainModuleName
  ? { modules: SubModules; name: MainModuleName; routes: MainRoutes }
  : ModulePath extends `${MainModuleName}/${infer Rest}`
    ? SplitPath<Rest> extends infer PathArray extends string[]
      ? PathArray["length"] extends 0
        ? never
        : FindModuleNested<{ modules: SubModules }, PathArray>
      : never
    : never;

type ExtractPaths<M extends { routes: readonly RouteShape[] }> =
  M["routes"][number]["route"]["path"];

type ExtractMethodForPath<
  M extends { routes: readonly RouteShape[] },
  P extends string,
> = Extract<M["routes"][number], { route: { path: P } }>["route"]["method"];

type ExtractZodType<T> = T extends z.ZodType ? z.infer<T> : never;

type InferInputType<
  RouteCfg extends RouteConfig,
  Part extends "body" | "params" | "query",
> = Part extends "body"
  ? RouteCfg extends {
      request: {
        body: { content: { "application/json": { schema: infer S } } };
      };
    }
    ? ExtractZodType<S>
    : RouteCfg extends { request: { body: { schema?: infer S } } }
      ? ExtractZodType<S>
      : undefined
  : Part extends "query"
    ? RouteCfg extends { request: { query: infer S } }
      ? ExtractZodType<S>
      : undefined
    : Part extends "params"
      ? RouteCfg extends { request: { params: infer S } }
        ? ExtractZodType<S>
        : undefined
      : never;

type FindRouteConfig<
  M extends { routes: readonly Route[] },
  P extends string,
  Method extends string,
> = Extract<
  M["routes"][number],
  { route: { method: Method; path: P } }
>["route"];

type BuildArgsType<RouteCfg extends RouteConfig> = {
  [
    K in "body" | "params" | "query" as InferInputType<
      RouteCfg,
      K
    > extends undefined
      ? never
      : K
  ]: InferInputType<RouteCfg, K>;
};

type InferStatusCode<K> = K extends `${infer N extends number}`
  ? N
  : K extends number
    ? K
    : never;

interface BaseFetcherParams<
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
  Method extends string,
> {
  method: Method;
  module: ModuleName;
  path: SelectedPath;
}

export type FetcherParams<
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
  RouteConfig extends FindRouteConfig<
    GetTargetModule<ModuleName, M, Routes, Modules>,
    SelectedPath,
    Method
  > = FindRouteConfig<
    GetTargetModule<ModuleName, M, Routes, Modules>,
    SelectedPath,
    Method
  >,
  ArgsType extends BuildArgsType<RouteConfig> = BuildArgsType<RouteConfig>,
> = BaseFetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> &
  (keyof ArgsType extends never ? { args?: undefined } : { args: ArgsType });

export type GetValidPathsForModule<
  ModulePath extends string,
  MainModuleName extends string,
  MainRoutes extends readonly RouteShape[],
  SubModules extends readonly ModuleSpec[],
> = ExtractPaths<
  GetTargetModule<ModulePath, MainModuleName, MainRoutes, SubModules>
>;

export type GetModulePaths<
  MainModule extends string,
  Modules extends readonly ModuleSpec[],
> =
  | `${MainModule}/${Modules[number]["name"]}/${Extract<
      Modules[number]["modules"],
      readonly ModuleSpec[]
    >[number]["name"]}`
  | `${MainModule}/${Modules[number]["name"]}`
  | MainModule;

export type GetValidMethodForPath<
  ModulePath extends string,
  Path extends string,
  MainModuleName extends string,
  MainRoutes extends readonly RouteShape[],
  SubModules extends readonly ModuleSpec[],
> = Lowercase<
  Extract<
    ExtractMethodForPath<
      GetTargetModule<ModulePath, MainModuleName, MainRoutes, SubModules>,
      Path
    >,
    string
  >
>;

export type InferResponseType<
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
  RouteConfig extends FindRouteConfig<
    GetTargetModule<ModuleName, M, Routes, Modules>,
    SelectedPath,
    Method
  > = FindRouteConfig<
    GetTargetModule<ModuleName, M, Routes, Modules>,
    SelectedPath,
    Method
  >,
> = RouteConfig extends { responses: infer S }
  ? {
      [K in keyof S]: S[K] extends infer Response
        ? Response extends { content: infer C }
          ? {
              [Fmt in keyof C]: ClientResponse<
                C[Fmt] extends { schema: infer S } ? ExtractZodType<S> : never,
                InferStatusCode<K>,
                Fmt extends string ? Fmt : string
              >;
            }[keyof C]
          : ClientResponse<object, InferStatusCode<K>>
        : never;
    }[keyof S]
  : never;
