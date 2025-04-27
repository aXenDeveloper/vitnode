import { BaseBuildModuleReturn, BuildModuleReturn } from '@/api/lib/module';
import { Route } from '@/api/lib/route';
import { usersModule } from '@/api/modules/users/users.module';
import { RouteConfig } from '@hono/zod-openapi';
import { z } from 'zod';

// --- Core Type Definitions ---

// Represents the expected shape of a route for type extraction
interface RouteShape {
  readonly route: {
    readonly method: string;
    readonly path: string;
  };
}

// Represents the expected shape of a module for type extraction
interface ModuleSpec {
  readonly modules?: readonly ModuleSpec[];
  readonly name: string;
  readonly routes: readonly RouteShape[];
}

// --- Utility Types ---

// Splits a path string like "a/b/c" into ["a", "b", "c"]
type SplitPath<S extends string> = S extends `${infer First}/${infer Rest}`
  ? [First, ...SplitPath<Rest>]
  : S extends '' // Handle empty string case
    ? []
    : [S];

// Recursively finds a nested module definition based on a path array
type FindModuleNested<
  M extends { modules?: readonly ModuleSpec[] },
  Path extends string[],
> = Path extends [infer First extends string, ...infer Rest extends string[]]
  ? // Find the sub-module matching the first path segment
    Extract<M['modules'], readonly ModuleSpec[]>[number] extends infer SubModule
    ? SubModule extends ModuleSpec & { name: First }
      ? // If this is the last segment, return the found sub-module
        Rest['length'] extends 0
        ? SubModule
        : // Otherwise, recurse into the found sub-module
          FindModuleNested<SubModule, Rest>
      : never // No sub-module found with that name
    : never // M['modules'] is not an array or is empty
  : // If Path is empty, it implies we are looking for the module M itself
    M;

// --- Simplified Module Path Types ---

// Creates a string union type of all possible module paths up to 3 levels deep
type GetModulePaths<
  MainModule extends string,
  Modules extends readonly ModuleSpec[],
> =
  | `${MainModule}/${Modules[number]['name']}/${Extract<
      Modules[number]['modules'],
      readonly ModuleSpec[]
    >[number]['name']}`
  | `${MainModule}/${Modules[number]['name']}`
  | MainModule;

// Helper to get the target module specification based on the module path string
type GetTargetModule<
  ModulePath extends string,
  MainModuleName extends string,
  MainRoutes extends readonly RouteShape[],
  SubModules extends readonly ModuleSpec[],
> = ModulePath extends MainModuleName
  ? { modules: SubModules; name: MainModuleName; routes: MainRoutes } // Return the main module spec
  : ModulePath extends `${MainModuleName}/${infer Rest}`
    ? SplitPath<Rest> extends infer PathArray extends string[]
      ? PathArray['length'] extends 0
        ? never // Path like "main/" is invalid
        : FindModuleNested<{ modules: SubModules }, PathArray>
      : never
    : never; // Path doesn't start with the main module name

// Extracts all possible path strings from a module's routes
type ExtractPaths<M extends { routes: readonly RouteShape[] }> =
  M['routes'][number]['route']['path'];

// Extracts the method string for a specific path within a module's routes
type ExtractMethodForPath<
  M extends { routes: readonly RouteShape[] },
  P extends string,
> = Extract<M['routes'][number], { route: { path: P } }>['route']['method'];

// --- Type extraction utilities ---

// Helper to extract types from Zod schemas that might be in different structures
type ExtractZodType<T> = T extends z.ZodTypeAny ? z.infer<T> : never;

// Infers the input type for a specific part of the route config (body, query, params)
type InferInputType<
  RouteCfg extends RouteConfig,
  Part extends 'body' | 'params' | 'query',
> = Part extends 'body'
  ? RouteCfg extends {
      request: {
        body: { content: { 'application/json': { schema: infer S } } };
      };
    }
    ? ExtractZodType<S>
    : RouteCfg extends { request: { body: { schema?: infer S } } }
      ? ExtractZodType<S>
      : undefined
  : Part extends 'query'
    ? RouteCfg extends { request: { query: infer S } }
      ? ExtractZodType<S>
      : undefined
    : Part extends 'params'
      ? RouteCfg extends { request: { params: infer S } }
        ? ExtractZodType<S>
        : undefined
      : never;

// --- Route Configuration Extraction ---

// Find the route configuration for a specific module path, route path, and method
type FindRouteConfig<
  M extends { routes: readonly Route[] },
  P extends string,
  Method extends string,
> = Extract<
  M['routes'][number],
  { route: { method: Method; path: P } }
>['route'];

// Constructs the final Args type based on the inferred input types
type BuildArgsType<RouteCfg extends RouteConfig> = {
  // Use key remapping to filter out keys where the inferred type is undefined
  [K in 'body' | 'params' | 'query' as InferInputType<
    RouteCfg,
    K
  > extends undefined
    ? never
    : K]: InferInputType<RouteCfg, K>;
};

// --- Fetcher Types ---

// Gets all valid path strings for a given module path
type GetValidPathsForModule<
  ModulePath extends string,
  MainModuleName extends string,
  MainRoutes extends readonly RouteShape[],
  SubModules extends readonly ModuleSpec[],
> = ExtractPaths<
  GetTargetModule<ModulePath, MainModuleName, MainRoutes, SubModules>
>;

// Gets the valid method for a given module path and route path
type GetValidMethodForPath<
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

// --- Fetcher Parameters ---

// Define the base parameters without args
interface BaseFetcherParams<
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
> {
  method: GetValidMethodForPath<ModuleName, SelectedPath, M, Routes, Modules>;
  module: ModuleName;
  path: SelectedPath;
}

// Use conditional type with intersection to define FetcherParams
type FetcherParams<
  // Module definition parameters
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  // Dynamic parameters based on user selection
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
  // Extract the route configuration and build the args type
  RouteConfig extends FindRouteConfig<
    GetTargetModule<ModuleName, M, Routes, Modules>,
    SelectedPath,
    GetValidMethodForPath<ModuleName, SelectedPath, M, Routes, Modules>
  > = FindRouteConfig<
    GetTargetModule<ModuleName, M, Routes, Modules>,
    SelectedPath,
    GetValidMethodForPath<ModuleName, SelectedPath, M, Routes, Modules>
  >,
  ArgsType extends BuildArgsType<RouteConfig> = BuildArgsType<RouteConfig>,
> = BaseFetcherParams<M, Routes, Modules, ModuleName, SelectedPath> & // Intersect with base
  (keyof ArgsType extends never
    ? { args?: undefined } // Args optional and undefined if ArgsType is empty
    : { args: ArgsType }); // Args required if ArgsType is not empty

// --- Fetcher Function ---

// Simplified fetcher with fewer generic type parameters
export function fetcher<
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
>(
  _moduleInput: BuildModuleReturn<string, M, Routes, Modules>,
  params: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath>,
): void {
  // Function implementation would go here
  void params; // Mark as unused for now
}

// Test cases
(() => {
  // Assuming /sign_in requires a body, this would now potentially error if args is missing
  // If it doesn't require args, this is fine.
  fetcher(usersModule, {
    path: '/sign_in',
    method: 'post',
    module: 'users',
    args: {
      body: {
        email: 'string',
        password: 'string',
      },
    },
  });

  fetcher(usersModule, {
    path: '/{providerId}',
    method: 'post',
    module: 'users/sso',
    args: {
      // args is required because params exist
      params: {
        providerId: 'github',
      },
    },
  });

  fetcher(usersModule, {
    path: '/{providerId}/callback',
    method: 'get',
    module: 'users/sso',
    args: {
      // args is required because params and query exist
      params: {
        providerId: 'github',
      },
      query: {
        code: 'some-code',
        state: 'some-state',
      },
    },
  });

  // Assuming /test does not require args, this is fine.
  fetcher(usersModule, {
    path: '/test',
    method: 'post',
    module: 'users/sso/test',
    // args is optional here if ArgsType is empty
  });

  // Should trigger error if required args are missing
  /* Error example (assuming /sign_in requires args):
  fetcher(usersModule, {
    path: '/sign_in',
    method: 'post',
    module: 'users',
    // Missing required 'args' property
  });
  */
})();
