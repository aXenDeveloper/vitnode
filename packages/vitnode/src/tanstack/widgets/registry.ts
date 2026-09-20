import type { BlockRegistry } from "@/blocks";

import { createBlockRegistry, getDefaultBlockRegistry } from "@/blocks";
import { blocks as coreBlocks } from "@/blocks/built-in";

let coreOnly: BlockRegistry | undefined;

/**
 * The registry a page's widget areas render and offer blocks from.
 *
 * The application's generated `blocks.gen.ts` installs a process default
 * holding every configured plugin's blocks, and that is what a zone uses
 * wherever it has been evaluated. Core cannot import that file - it is written
 * into the app - so a page in an install that never renders blocks anywhere
 * else still gets core's own three rather than a missing-registry error.
 */
export const pageWidgetsRegistry = (): BlockRegistry => {
  const installed = getDefaultBlockRegistry();

  if (installed) return installed;

  coreOnly ??= createBlockRegistry([coreBlocks]);

  return coreOnly;
};
