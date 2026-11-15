import { BlockRegistryMissingError } from "@vitnode/api/blocks/errors";
import {
  createBlockRegistry as createSchemaRegistry,
  setDefaultBlockRegistry as setDefaultValidationRegistry,
} from "@vitnode/api/blocks/registry";

import type {
  AnyBlockDefinition,
  BlockPluginSource,
  BlockRegistry,
} from "./types";

export { allowedBlocks, isBlockAllowed } from "@vitnode/api/blocks/registry";

/**
 * Builds the renderer registry from every plugin's widgets - definitions with
 * their components - prefixing each id with its namespace, exactly as the API
 * does for the schemas. The app's generated `src/blocks.gen.ts` calls this and
 * installs the result as the default.
 *
 * @throws {BlockError} When two plugins claim one namespace, one plugin uses
 * two, or a qualified id is registered twice.
 */
export const createBlockRegistry = (
  sources: readonly BlockPluginSource[],
): BlockRegistry => createSchemaRegistry<AnyBlockDefinition>(sources);

let processDefault: BlockRegistry | undefined;

/**
 * Installs the process-wide renderer registry - widgets with their components -
 * used when none is passed explicitly. The app's generated `src/blocks.gen.ts`
 * calls it when it is evaluated.
 *
 * It also becomes the default that widget validation reads (the API's
 * `setDefaultBlockRegistry` from `@vitnode/api/blocks`), so the browser checks
 * `blocks` fields against the same widgets. The API never replaces this
 * renderer registry: in an app that also mounts the API, the API installs its
 * schema registry for validation only.
 *
 * @returns A function restoring the previous defaults.
 */
export const setDefaultBlockRegistry = (
  registry: BlockRegistry | undefined,
): (() => void) => {
  const previous = processDefault;
  processDefault = registry;
  const restoreValidation = setDefaultValidationRegistry(registry);

  return () => {
    processDefault = previous;
    restoreValidation();
  };
};

export const getDefaultBlockRegistry = (): BlockRegistry | undefined =>
  processDefault;

/**
 * The given renderer registry, else the process default.
 *
 * @throws {BlockRegistryMissingError} When neither exists.
 */
export const resolveBlockRegistry = (
  registry?: BlockRegistry,
): BlockRegistry => {
  const resolved = registry ?? processDefault;
  if (!resolved) throw new BlockRegistryMissingError();

  return resolved;
};
