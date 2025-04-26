import { BaseBuildModuleReturn, BuildModuleReturn } from '@/api/lib/module';
import { Route } from '@/api/lib/route';
import { usersModule } from '@/api/modules/users/users.module';

interface RouteSpec {
  readonly method: string;
  readonly path: string;
}

interface RouteShape {
  readonly route: RouteSpec;
}

interface ModuleSpec {
  readonly modules?: readonly ModuleSpec[];
  readonly name: string;
  readonly routes: readonly RouteShape[];
}

type SplitPath<S extends string> = S extends `${infer First}/${infer Rest}`
  ? [First, ...SplitPath<Rest>]
  : [S];

type FindModuleNested<
  M extends { modules?: readonly ModuleSpec[] },
  Path extends string[],
> = Path extends [infer First extends string, ...infer Rest extends string[]]
  ? Rest['length'] extends 0
    ? Extract<M['modules'], readonly ModuleSpec[]>[number] extends infer SubM
      ? Extract<SubM, { name: First }>
      : never
    : FindModuleNested<
        Extract<
          Extract<M['modules'], readonly ModuleSpec[]>[number],
          { name: First }
        >,
        Rest
      >
  : M;

type ExtractPaths<M extends { routes: readonly RouteShape[] }> =
  M['routes'][number]['route']['path'];

type ExtractMethod<
  M extends { routes: readonly RouteShape[] },
  P extends string,
> = Extract<M['routes'][number]['route'], { path: P }>['method'];

type GetModulePaths<
  ModulePath extends string,
  MainModule extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
> = ModulePath extends MainModule
  ? ExtractPaths<{ routes: Routes }>
  : ModulePath extends `${MainModule}/${infer Rest}`
    ? ExtractPaths<FindModuleNested<{ modules: Modules }, SplitPath<Rest>>>
    : never;

type GetModuleMethod<
  ModulePath extends string,
  MainModule extends string,
  Path extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
> = ModulePath extends MainModule
  ? ExtractMethod<{ routes: Routes }, Path>
  : ModulePath extends `${MainModule}/${infer Rest}`
    ? ExtractMethod<
        FindModuleNested<{ modules: Modules }, SplitPath<Rest>>,
        Path
      >
    : never;

interface FetcherParams<
  P extends string,
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn<P>[],
  ModuleName extends string,
  SelectedPath extends GetModulePaths<ModuleName, M, Routes, Modules>,
> {
  input?: string;
  method: Lowercase<
    GetModuleMethod<ModuleName, M, SelectedPath, Routes, Modules>
  >;
  module: ModuleName;
  path: SelectedPath;
}

export function fetcher<
  P extends string,
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn<P>[],
  ModuleName extends
    | `${M}/${Modules[number]['name']}/${Extract<
        Modules[number]['modules'],
        readonly BaseBuildModuleReturn<P>[]
      >[number]['name']}`
    | `${M}/${Modules[number]['name']}`
    | M,
  SelectedPath extends GetModulePaths<ModuleName, M, Routes, Modules>,
>(
  moduleInput: BuildModuleReturn<P, M, Routes, Modules>,
  params: FetcherParams<P, M, Routes, Modules, ModuleName, SelectedPath>,
): void {
  void moduleInput;
  void params;
}

// Example usage
(() => {
  fetcher(usersModule, {
    path: '/session',
    method: 'get',
    module: 'users',
  });

  fetcher(usersModule, {
    path: '/{providerId}',
    method: 'post',
    module: 'users/sso',
  });

  fetcher(usersModule, {
    path: '/session',
    method: 'post',
    module: 'users',
  });

  fetcher(usersModule, {
    path: '/{providerId}',
    method: 'get',
    module: 'users/sso',
  });
})();
