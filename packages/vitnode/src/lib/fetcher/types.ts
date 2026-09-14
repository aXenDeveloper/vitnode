import type { ResponseFormat } from "hono/types";
import type { StatusCode, SuccessStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

import type { ApiPluginRegistry } from "./registry";

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

export interface ModuleSpec {
  readonly modules?: readonly ModuleSpec[];
  readonly name: string;
  readonly routes: readonly RouteShape[];
}

interface ApiPluginSpec {
  readonly modules: readonly ModuleSpec[];
  readonly pluginId: string;
}

type ApiPluginFactory = (...args: never[]) => ApiPluginSpec;

type ApiPluginWithId<T, P extends string> = Extract<T, { pluginId: P }>;

type ResolveApiPluginExport<
  Entry,
  P extends string,
> = Entry extends ApiPluginFactory
  ? ApiPluginWithId<ReturnType<Entry>, P>
  : Entry extends ApiPluginSpec
    ? ApiPluginWithId<Entry, P>
    : never;

type ResolveApiPluginEntry<Entry, P extends string> = Entry extends
  ApiPluginFactory | ApiPluginSpec
  ? ResolveApiPluginExport<Entry, P>
  : {
      [K in keyof Entry]: ResolveApiPluginExport<Entry[K], P>;
    }[keyof Entry];

export type RegisteredPluginId = Extract<keyof ApiPluginRegistry, string>;

export type RegisteredApiPlugin<P extends RegisteredPluginId> =
  ResolveApiPluginEntry<ApiPluginRegistry[P], P>;

type RegisteredModules<P extends RegisteredPluginId> =
  RegisteredApiPlugin<P> extends {
    modules: infer M extends readonly ModuleSpec[];
  }
    ? M
    : never;

type SubModules<M extends ModuleSpec> = Extract<
  M["modules"],
  readonly ModuleSpec[]
>;

type IsTypedModule<M extends ModuleSpec> = string extends M["name"]
  ? false
  : string extends M["routes"][number]["route"]["path"]
    ? false
    : true;

type ModulePathOf<M extends ModuleSpec> = M extends ModuleSpec
  ? IsTypedModule<M> extends true
    ? `${M["name"]}/${ModulePathOf<SubModules<M>[number]>}` | M["name"]
    : never
  : never;

export type PluginModulePath<P extends RegisteredPluginId> = ModulePathOf<
  RegisteredModules<P>[number]
>;

type ModuleNamed<
  Modules extends readonly ModuleSpec[],
  Name extends string,
> = Extract<Modules[number], { name: Name }>;

type ResolveModule<
  Modules extends readonly ModuleSpec[],
  Path extends string,
> = Path extends `${infer Head}/${infer Rest}`
  ? ResolveModule<SubModules<ModuleNamed<Modules, Head>>, Rest>
  : ModuleNamed<Modules, Path>;

export type PluginModule<
  P extends RegisteredPluginId,
  M extends string,
> = ResolveModule<RegisteredModules<P>, M>;

type RoutesOf<Mod> = Mod extends {
  routes: infer Routes extends readonly RouteShape[];
}
  ? Routes[number]
  : never;

export type PluginRoutePath<
  P extends RegisteredPluginId,
  M extends string,
> = RoutesOf<PluginModule<P, M>>["route"]["path"];

export type PluginRouteMethod<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
> = Lowercase<
  Extract<
    Extract<
      RoutesOf<PluginModule<P, M>>,
      { route: { path: Path } }
    >["route"]["method"],
    string
  >
>;

export type PluginRouteConfig<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
> = Extract<
  RoutesOf<PluginModule<P, M>>,
  { route: { method: Method; path: Path } }
>["route"];

export interface UnknownModulePath<Valid extends string> {
  readonly validModulePaths: Valid;
}

export interface UnknownRoutePath<Valid extends string> {
  readonly validRoutePaths: Valid;
}

export interface UnknownRouteMethod<Valid extends string> {
  readonly validMethods: Valid;
}

type ValidModule<P extends RegisteredPluginId, M extends string> =
  M extends PluginModulePath<P> ? M : UnknownModulePath<PluginModulePath<P>>;

type ValidPath<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
> =
  M extends PluginModulePath<P>
    ? Path extends PluginRoutePath<P, M>
      ? Path
      : UnknownRoutePath<PluginRoutePath<P, M>>
    : Path;

type ValidMethod<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
> =
  M extends PluginModulePath<P>
    ? Path extends PluginRoutePath<P, M>
      ? Method extends PluginRouteMethod<P, M, Path>
        ? Method
        : UnknownRouteMethod<PluginRouteMethod<P, M, Path>>
      : Method
    : Method;

type ExtractZodType<T> = T extends z.ZodType ? z.infer<T> : never;

type InferInputType<
  RouteCfg,
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

export type BuildArgsType<RouteCfg> = {
  [
    K in "body" | "params" | "query" as InferInputType<
      RouteCfg,
      K
    > extends undefined
      ? never
      : K
  ]: InferInputType<RouteCfg, K>;
};

export type FetcherArgs<RouteCfg> = [RouteCfg] extends [never]
  ? { args?: unknown }
  : keyof BuildArgsType<RouteCfg> extends never
    ? { args?: undefined }
    : { args: BuildArgsType<RouteCfg> };

type InferStatusCode<K> = K extends `${infer N extends number}`
  ? N
  : K extends number
    ? K
    : never;

export interface FetcherRoute<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
> {
  method: Method & ValidMethod<P, M, Path, Method>;
  module: M & ValidModule<P, M>;
  path: Path & ValidPath<P, M, Path>;
  plugin: P;
}

export type FetcherRequest<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string = PluginRouteMethod<P, M, Path>,
> = FetcherArgs<PluginRouteConfig<P, M, Path, Method>> &
  FetcherRoute<P, M, Path, Method>;

/**
 * Everything a fetcher takes that is *not* the route.
 *
 * Shared so `coreFetcher`, `fetcher` and `fetcherClient` describe one transport
 * rather than three that drift, and so the route half of every call stays
 * exactly {@link FetcherRequest} - which is what makes a missing `args` an error.
 */
export interface FetcherRequestOptions {
  additionalHeaders?: HeadersInit;
  /**
   * Raw `multipart/form-data` body for file uploads. When set, the JSON
   * `Content-Type` is omitted so the runtime can add the multipart boundary,
   * and this is sent as the request body instead of `JSON.stringify(args.body)`.
   */
  formData?: FormData;
  /**
   * Extra `fetch` init - `credentials`, an {@link AbortSignal}. `method` is
   * omitted with `body` and `headers` because `rawApiFetch` computes those
   * three itself; see its own note.
   */
  options?: Omit<RequestInit, "body" | "headers" | "method">;
  /**
   * Origin to call, instead of the `VITNODE_API_URL` one. Set by a runtime
   * that serves the API itself and knows the origin only per request; see
   * `RawApiFetchArgs["origin"]`.
   */
  origin?: string;
  withPagination?: boolean;
}

export type InferResponseType<RouteCfg> = RouteCfg extends {
  responses: infer S;
}
  ? {
      [K in keyof S]: S[K] extends infer Response
        ? Response extends { content: infer C }
          ? {
              [Fmt in keyof C]: ClientResponse<
                C[Fmt] extends { schema: infer Schema }
                  ? ExtractZodType<Schema>
                  : never,
                InferStatusCode<K>,
                Fmt extends string ? Fmt : string
              >;
            }[keyof C]
          : ClientResponse<object, InferStatusCode<K>>
        : never;
    }[keyof S]
  : never;

export type FetcherResponse<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string = PluginRouteMethod<P, M, Path>,
> = InferResponseType<PluginRouteConfig<P, M, Path, Method>>;
