import type { ResponseFormat } from "hono/types";
import type { StatusCode, SuccessStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

import type { ApiEndpoint, ApiModuleContract } from "./contract";
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

export type RegisteredPluginId = Extract<keyof ApiPluginRegistry, string>;

/**
 * Every endpoint one plugin serves, as one flat union.
 *
 * A plain lookup: the flattening happened once, in the plugin's own
 * `ApiPluginContract`, and the registry stores the result.
 */
/**
 * The three things a call reads off a registry entry, each behind its own
 * inference so that reading one never resolves the others.
 *
 * `ApiPluginRegistry` is an open interface, so an indexed access on it cannot be
 * proven valid for an entry some augmentation adds - hence the conditional. It
 * matches on one member at a time on purpose: a guard stated as the whole
 * contract would resolve `endpoints` too, and flattening every endpoint an
 * installation serves is work no ordinary call needs.
 */
type ModulePathsOf<P extends RegisteredPluginId> =
  ApiPluginRegistry[P] extends { modulePaths: infer Paths extends string }
    ? Paths
    : never;

type ModulesOf<P extends RegisteredPluginId> = ApiPluginRegistry[P] extends {
  modules: infer Modules extends readonly ApiModuleContract[];
}
  ? Modules
  : never;

export type PluginEndpoints<P extends RegisteredPluginId> =
  ApiPluginRegistry[P] extends { endpoints: infer E extends ApiEndpoint }
    ? E
    : never;

export type AllEndpoints = PluginEndpoints<RegisteredPluginId>;

type ValidModule<P extends RegisteredPluginId, M extends string> =
  M extends PluginModulePath<P> ? M : PluginModulePath<P>;

/**
 * Both checks stop at the first field that is wrong, and report there.
 *
 * A module nobody serves has no paths and no methods, so validating those too
 * would answer `never` and put three errors on one mistake - burying the field
 * that actually needs fixing.
 */
type ValidPath<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
> =
  M extends PluginModulePath<P>
    ? Path extends PluginRoutePath<P, M>
      ? Path
      : PluginRoutePath<P, M>
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
        : PluginRouteMethod<P, M, Path>
      : Method
    : Method;

/**
 * The route half of a call.
 *
 * Each field is its own type parameter intersected with what the registry says
 * is valid there. Two things depend on that shape and would break without it:
 *
 * - The intersection with the bare parameter is what keeps the literal. A field
 *   typed as the conditional alone makes the compiler compute a base constraint
 *   it cannot finish on a cold checker, and the literal widens to `string` -
 *   after which inference falls back to the union of every route and nothing is
 *   checked at all.
 * - Inferring the four fields separately, rather than the request object as a
 *   whole, is what leaves `args` typed by the route instead of by whatever the
 *   caller wrote. Excess property checking only fires against a parameter's own
 *   declared property type, so this is what rejects a key the Zod schema does
 *   not declare.
 */
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

type ModuleNamed<
  Modules extends readonly ApiModuleContract[],
  Name extends string,
> = Extract<Modules[number], { name: Name }>;

type ChildrenOf<M extends ApiModuleContract> = Extract<
  M["modules"],
  readonly ApiModuleContract[]
>;

/**
 * The module a path names, resolved a segment at a time.
 *
 * Every step compares against one module's own children on the `name` property
 * alone - a handful of siblings, one property each - so `admin/advanced/cron`
 * costs three small comparisons. Filtering a flat union of every endpoint the
 * plugin serves costs one comparison per endpoint instead, on every call.
 *
 * Indexed access rather than `infer`: both answer the same type, and the extra
 * conditional an `infer` needs is paid at every segment of every call.
 */
type ResolveModule<
  Modules extends readonly ApiModuleContract[],
  Path extends string,
> = Path extends `${infer Head}/${infer Rest}`
  ? ResolveModule<ChildrenOf<ModuleNamed<Modules, Head>>, Rest>
  : ModuleNamed<Modules, Path>;

type RoutesOfModule<
  P extends RegisteredPluginId,
  M extends string,
> = ResolveModule<ModulesOf<P>, M>["routes"][number];

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

export type FetcherArgs<RouteCfg> = keyof BuildArgsType<RouteCfg> extends never
  ? { args?: undefined }
  : { args: BuildArgsType<RouteCfg> };

type InferStatusCode<K> = K extends `${infer N extends number}`
  ? N
  : K extends number
    ? K
    : never;

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

/**
 * One endpoint as the four fields that identify it.
 *
 * Deliberately without `args`: this union holds every endpoint the installation
 * serves, and inferring each one's Zod body, params and query here would make
 * every call site pay for the arguments of every *other* route. A call's own
 * arguments are resolved once, from the route it selected - see
 * {@link FetcherCall}.
 */
type RequestForEndpoint<E> = E extends ApiEndpoint
  ? {
      method: E["method"];
      module: E["module"];
      path: E["path"];
      plugin: E["plugin"];
    }
  : never;

/**
 * Every call the configured plugins accept, as one discriminated union.
 *
 * `plugin`, `module`, `path` and `method` are literal in every member, so the
 * compiler picks the endpoint a caller wrote rather than testing members one by
 * one - and reports a wrong `method` or `args` against that endpoint instead of
 * against the whole union. It is also what a completion inside a call reads:
 * one indexed access into a union the compiler has already built, where
 * enumerating a plugin's module paths used to re-walk its module tree.
 */
export type ApiRequest = RequestForEndpoint<AllEndpoints>;

/** The route one call selected, resolved through its plugin's module tree. */
export type RouteOf<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
> = Extract<
  RoutesOfModule<P, M>,
  { route: { method: Method; path: Path } }
>["route"];

export type ResponseFor<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
> = InferResponseType<RouteOf<P, M, Path, Method>>;

/**
 * Everything a fetcher takes that is *not* the route.
 *
 * Shared so `coreFetcher`, `fetcher` and `fetcherClient` describe one transport
 * rather than three that drift, and so the route half of every call stays
 * exactly {@link ApiRequest} - which is what makes a missing `args` an error.
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

/**
 * One call: the endpoint, its arguments, and whatever the transport accepts.
 *
 * The arguments are typed by the route the four literal fields selected, and by
 * nothing else - which is what makes a key the Zod schema does not declare an
 * error, and what keeps `allowSaveCookies` off a call a browser might make.
 */
export type FetcherCall<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
  Options,
> = FetcherArgs<RouteOf<P, M, Path, Method>> &
  FetcherRoute<P, M, Path, Method> &
  Options;

/** Every module path one plugin serves. */
/**
 * Every module path one plugin serves.
 *
 * One indexed access into a union the plugin already computed. This is what a
 * completion for `module` reads, and deriving it per call site by walking the
 * module tree is what made typing one slow.
 */
export type PluginModulePath<P extends RegisteredPluginId> = ModulePathsOf<P>;

/** Every route path one module serves. */
export type PluginRoutePath<
  P extends RegisteredPluginId,
  M extends string,
> = RoutesOfModule<P, M>["route"]["path"];

/** Every method one route answers. */
export type PluginRouteMethod<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
> = Lowercase<
  Extract<RoutesOfModule<P, M>, { route: { path: Path } }>["route"]["method"]
>;
