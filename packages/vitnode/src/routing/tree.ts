import type {
  PluginRouteArea,
  PluginRouteKind,
  PluginRouteRequirement,
} from "./types";

const LAZY_BRAND = Symbol.for("vitnode.plugin-routes.lazy");
const DECLARATION_BRAND = Symbol.for("vitnode.plugin-routes.declaration");

export interface PluginRouteLazyComponent<TModule = unknown> {
  readonly [LAZY_BRAND]: true;
  readonly load: () => Promise<TModule>;
}

export const lazy = <TModule>(
  load: () => Promise<TModule>,
): PluginRouteLazyComponent<TModule> => ({
  [LAZY_BRAND]: true,
  load,
});

export const isPluginRouteLazyComponent = (
  value: unknown,
): value is PluginRouteLazyComponent => {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<PluginRouteLazyComponent>;

  return candidate[LAZY_BRAND] === true && typeof candidate.load === "function";
};

type ModuleSearchOf<TModule> = TModule extends {
  default: (props: infer TProps) => unknown;
}
  ? TProps extends { search: infer TSearch }
    ? TSearch
    : Record<string, unknown>
  : Record<string, unknown>;

export type PluginRouteSearchSchema<TModule> = (
  input: Record<string, unknown>,
) => ModuleSearchOf<TModule>;

interface PluginRouteDeclarationShared<TModule> {
  component:
    | '`component` must be lazy(() => import("./pages/my-page")): a component imported into routes.ts is in the initial bundle, so its page cannot be split into a chunk of its own.'
    | PluginRouteLazyComponent<TModule>;
  messages?: readonly string[];
  requires?: PluginRouteRequirement;
}

export type PluginRouteEagerComponentRejected = Exclude<
  PluginRouteDeclarationShared<unknown>["component"],
  object
>;

/** Either spelling of a `component` field: the lazy one, or the rejection. */
export type PluginRouteComponent<TModule = unknown> =
  PluginRouteDeclarationShared<TModule>["component"];

export interface PluginRoutePageOptions<
  TModule,
> extends PluginRouteDeclarationShared<TModule> {
  area?: PluginRouteArea;
  search?: PluginRouteSearchSchema<TModule>;
}

export interface PluginRouteIndexOptions<
  TModule,
> extends PluginRouteDeclarationShared<TModule> {
  search?: PluginRouteSearchSchema<TModule>;
}

export interface PluginRouteLayoutOptions<
  TModule,
> extends PluginRouteDeclarationShared<TModule> {
  area?: PluginRouteArea;
  children: readonly PluginRouteDeclaration[];
}

export interface PluginRouteDeclaration {
  readonly area: PluginRouteArea | undefined;
  readonly children: readonly PluginRouteDeclaration[] | undefined;
  readonly component: unknown;
  readonly [DECLARATION_BRAND]: true;
  readonly isIndex: boolean;
  readonly kind: PluginRouteKind;
  readonly messages: readonly string[] | undefined;
  readonly path: null | string;
  readonly requires: PluginRouteRequirement | undefined;
  readonly search: unknown;
}

export type PluginRoutes = readonly PluginRouteDeclaration[];

export interface PluginRouteDeclarationSource {
  pluginId: string;
  routes: PluginRoutes;
}

export const isPluginRouteDeclaration = (
  value: unknown,
): value is PluginRouteDeclaration =>
  typeof value === "object" &&
  value !== null &&
  (value as Partial<PluginRouteDeclaration>)[DECLARATION_BRAND] === true;

interface PluginRouteDeclarationOptions {
  area?: PluginRouteArea;
  children?: readonly PluginRouteDeclaration[];
  component: unknown;
  messages?: readonly string[];
  requires?: PluginRouteRequirement;
  search?: unknown;
}

const declaration = (
  options: PluginRouteDeclarationOptions & {
    isIndex: boolean;
    kind: PluginRouteKind;
    path: null | string;
  },
): PluginRouteDeclaration => ({
  [DECLARATION_BRAND]: true,
  area: options.area,
  children: options.children,
  component: options.component,
  isIndex: options.isIndex,
  kind: options.kind,
  messages: options.messages,
  path: options.path,
  requires: options.requires,
  search: options.search,
});

export const page = <TModule>(
  path: string,
  options: PluginRoutePageOptions<TModule>,
): PluginRouteDeclaration =>
  declaration({
    ...(options as PluginRouteDeclarationOptions),
    isIndex: false,
    kind: "page",
    path,
  });

export const index = <TModule>(
  options: PluginRouteIndexOptions<TModule>,
): PluginRouteDeclaration =>
  declaration({
    ...(options as PluginRouteDeclarationOptions),
    isIndex: true,
    kind: "page",
    path: null,
  });

export const layout = <TModule>(
  path: string,
  options: PluginRouteLayoutOptions<TModule>,
): PluginRouteDeclaration =>
  declaration({
    ...(options as PluginRouteDeclarationOptions),
    isIndex: false,
    kind: "layout",
    path,
  });

export const definePluginRoutes = (routes: PluginRoutes): PluginRoutes => {
  if (!Array.isArray(routes)) {
    throw new Error(
      "[VitNode plugin routes] definePluginRoutes takes an array of routes built with page(), layout() or index().",
    );
  }

  routes.forEach((route: unknown, position) => {
    if (isPluginRouteDeclaration(route)) return;

    throw new Error(
      `[VitNode plugin routes] definePluginRoutes received something at position ${String(position)} that was not built with page(), layout() or index(). Wrap every route in one of those - a plain object cannot carry the kind of route it is.`,
    );
  });

  return routes;
};
