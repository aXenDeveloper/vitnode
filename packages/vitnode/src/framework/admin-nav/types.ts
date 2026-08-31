/**
 * One configured plugin's AdminCP navigation module, as the build resolved it.
 *
 * The whole of what discovery produces: which plugin, and the specifier the
 * generated file imports it by. Deliberately not the navigation itself - the
 * declarations stay compiled in the plugin's own `dist`, exactly as its route
 * modules do, and the application holds one generated line of registration per
 * plugin rather than a copy of anybody's data.
 */
export interface ResolvedAdminNavModule {
  pluginId: string;
  /** `@vitnode/example/admin/nav` - a package export subpath, literal. */
  specifier: string;
}
