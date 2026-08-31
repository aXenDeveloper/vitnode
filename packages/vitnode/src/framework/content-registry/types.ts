/**
 * One configured plugin's Content Engine frontend module, as the build resolved
 * it.
 *
 * The whole of what discovery produces: which plugin, and the specifier the
 * generated file imports it by. Deliberately not the registrations themselves -
 * they are React components, and a build tool has no business evaluating them.
 * The declarations stay compiled in the plugin's own `dist`, exactly as its
 * route modules and its navigation do, and the application holds one generated
 * line of registration per plugin rather than a copy of anybody's data.
 *
 * Identical in shape to `ResolvedAdminNavModule`, and kept as its own type
 * rather than shared: the two describe different subpaths with different
 * contracts, and a future field on one - a content module's lazy boundary, say -
 * must not silently appear on the other.
 */
export interface ResolvedContentRegistryModule {
  pluginId: string;
  /** `@vitnode/example/admin/content` - a package export subpath, literal. */
  specifier: string;
}
