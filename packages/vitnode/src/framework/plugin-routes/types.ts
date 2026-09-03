/**
 * One configured plugin's route module, paired with the specifier that imports
 * it.
 *
 * The whole of what the build has to work out per plugin, and deliberately not
 * per *route*: a plugin declares its routes in one browser-safe module - `<plugin
 * id>/routes` - and the generated file imports that module statically. Which
 * page belongs to which route, and which chunk each page ends up in, is decided
 * by the literal `import()` inside the plugin's own `lazy()` calls, which Vite
 * follows without anything here naming a page.
 */
export interface ResolvedPluginRoutesModule {
  pluginId: string;
  specifier: string;
}
