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

/**
 * The `search` type a route's own page module says it reads.
 *
 * The one place the eager half of a route and its lazy module are checked
 * against each other, and it works for the reason `lazy()` is worth having:
 * `import("./pages/products-page")` is a *type* TypeScript resolves statically
 * even though the import itself is deferred. So a page declaring
 * `PluginRoutePageProps<Product, ProductsSearch>` constrains the schema its
 * route declares, without either file importing the other's values.
 *
 * `Record<string, unknown>` when the module says nothing about a search - a page
 * with no props, or one that never named the type - because an unconstrained
 * schema is the honest answer there rather than a guess. The page still gets
 * whatever the schema returned; nothing is checked twice at runtime.
 */
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
  /**
   * The module this route renders, named by `lazy(() => import(...))`.
   *
   * The union's second member is a string, and it is the diagnostic rather than
   * a shape: TypeScript prints the type it expected, so writing the fix *as*
   * that type is what turns `component: ProductPage` from
   *
   *     Type '() => Element' is not assignable to type
   *     'PluginRouteLazyComponent<unknown>'
   *
   * into an error that says what to do instead. Inlined rather than aliased for
   * the same reason: an alias would be printed by name, and the message would go
   * back to naming a shape.
   */
  component:
    | '`component` must be lazy(() => import("./pages/my-page")): a component imported into routes.ts is in the initial bundle, so its page cannot be split into a chunk of its own.'
    | PluginRouteLazyComponent<TModule>;
  messages?: readonly string[];
  requires?: PluginRouteRequirement;
}

/**
 * What a `component` may not be - the message above, as a type.
 *
 * Derived from the field rather than declared beside it, so there is one copy of
 * the sentence and a reader who searches for it lands on the union that produces
 * it.
 */
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

/**
 * One plugin's `routes.ts`, as a host holds it.
 *
 * The shape of every entry in a generated `src/plugin-routes.gen.ts`: the plugin
 * id, and the route tree that plugin's own module exported. `routes` is typed
 * here rather than left `unknown` so a plugin whose `routes` export is not a
 * `definePluginRoutes` tree is a compile error in the generated file, naming the
 * plugin, instead of a runtime diagnostic in a browser.
 */
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

/**
 * Every field a declaration may carry, whichever helper made it.
 *
 * The three helpers accept narrower types - a layout has `children` and no
 * `search`, an index route has neither a `path` nor an `area` - and all three
 * pass whatever they were given through this. That is deliberate: a plugin
 * written in JavaScript has no types to stop it declaring `search` on a layout,
 * and a field silently dropped here would be a page whose query string is
 * quietly never validated. Carried, it reaches `flattenPluginRoutes` and becomes
 * a diagnostic naming the route.
 */
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
