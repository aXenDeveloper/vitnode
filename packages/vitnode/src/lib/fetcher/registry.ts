import type { VitNodeApiPlugin } from "@/api/plugin";

/**
 * The API of every plugin this installation serves, keyed by plugin id.
 *
 * Core registers itself below. An application adds one entry per configured
 * plugin from its generated `src/api-registry.gen.ts`, and that generated file
 * is the only place an installed plugin is registered - a package that
 * augmented this globally would put its routes in the registry of every
 * consumer, configured or not.
 *
 * Each entry is an {@link ApiPluginContract}: the plugin id, the module tree and
 * the route definitions, and nothing else. The Hono application, the content
 * models, the listeners, the queues and the search indexers a plugin also
 * carries are runtime concerns, and resolving them here would make every
 * keystroke in a `fetcher` call pay for them.
 */
export interface ApiPluginRegistry {
  "@vitnode/core": VitNodeApiPlugin;
}
