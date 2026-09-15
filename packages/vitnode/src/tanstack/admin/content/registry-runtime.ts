import type { ContentFrontendRegistry } from "@/content/admin/registry";

export type ContentRegistryLoader = () => Promise<ContentFrontendRegistry>;

let loadRegistry: ContentRegistryLoader | undefined;

/**
 * Registers where the Content Engine's admin screens read their registry from.
 *
 * The one genuinely application-specific value the Content Engine's routes need,
 * and the reason it is registered rather than imported: the registry is built by
 * the app's own `content-registry.gen.ts`, from the plugins that app configured.
 * Core cannot name that file, and it must not be in core's import graph - it
 * carries every content type's editor fields and form layouts, which belong in
 * the chunk of the screen that renders them and nowhere else.
 *
 * Call it from a module the router entry imports, the way `configureIntl` is
 * called. A thunk, not a registry: nothing is loaded until an admin opens a
 * content screen.
 */
export const configureContentRegistry = (
  loader: ContentRegistryLoader,
): void => {
  loadRegistry = loader;
};

export const getContentRegistryLoader = (): ContentRegistryLoader => {
  if (!loadRegistry) {
    throw new Error(
      "[VitNode] The Content Engine's admin registry is not configured - call `configureContentRegistry(() => import('./content-registry.gen').then(m => m.contentRegistry))` from a module your router entry imports.",
    );
  }

  return loadRegistry;
};

/** Drops the registered loader. Exported for tests. */
export const resetContentRegistry = (): void => {
  loadRegistry = undefined;
};
