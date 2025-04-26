import { BaseBuildModuleReturn, BuildModuleReturn } from '@/api/lib/module';
import { Route } from '@/api/lib/route';
import { usersModule } from '@/api/modules/users/users.module';

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

// Helper to get the target module specification based on the module path string
// It handles the base module case and nested module cases.
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

// --- Derived Types for Fetcher ---

// Gets all valid path strings for a given module path (e.g., "users" or "users/sso")
type GetValidPathsForModule<
  ModulePath extends string,
  MainModuleName extends string,
  MainRoutes extends readonly RouteShape[],
  SubModules extends readonly ModuleSpec[],
> = ExtractPaths<
  GetTargetModule<ModulePath, MainModuleName, MainRoutes, SubModules>
>;

// Gets the valid method (lowercase) for a given module path and a specific path within that module
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
    string // Ensure we only get string methods
  >
>;

// --- Fetcher Function Definition ---

// Define the structure for the fetcher parameters, using the derived types for constraints
interface FetcherParams<
  // Generic parameters from BuildModuleReturn
  P extends string,
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn<P>[],
  // The specific module path string provided by the user (e.g., "users/sso")
  // This complex union type accurately constrains valid module paths.
  ModuleName extends
    | `${M}/${Modules[number]['name']}/${Extract<
        Modules[number]['modules'],
        readonly BaseBuildModuleReturn<P>[]
      >[number]['name']}` // Second level sub-module
    | `${M}/${Modules[number]['name']}` // First level sub-module (e.g., "users/sso")
    // Add support for deeper nesting if necessary:
    | M, // Base module name (e.g., "users")
  // The specific path string selected within the chosen module
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
> {
  input?: unknown; // TODO: Define input type based on the route if possible
  method: GetValidMethodForPath<ModuleName, SelectedPath, M, Routes, Modules>;
  module: ModuleName;
  path: SelectedPath;
}

// The fetcher function signature
export function fetcher<
  // Generic parameters matching BuildModuleReturn
  P extends string,
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn<P>[],
  // Constrain ModuleName to valid possibilities based on the module structure
  ModuleName extends
    | `${M}/${Modules[number]['name']}/${Extract<
        Modules[number]['modules'],
        readonly BaseBuildModuleReturn<P>[]
      >[number]['name']}`
    | `${M}/${Modules[number]['name']}`
    | M,
  // SelectedPath is constrained based on the chosen ModuleName
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
>(
  _moduleInput: BuildModuleReturn<P, M, Routes, Modules>, // Mark as unused
  params: FetcherParams<P, M, Routes, Modules, ModuleName, SelectedPath>,
): void {
  // Function implementation would go here
  void params; // Mark as unused for now
}

(() => {
  fetcher(usersModule, {
    path: '/test',
    method: 'get',
    module: 'users',
  });

  fetcher(usersModule, {
    path: '/{providerId}',
    method: 'post',
    module: 'users/sso',
  });

  fetcher(usersModule, {
    path: '/{providerId}/callback',
    method: 'get',
    module: 'users/sso',
  });
})();
