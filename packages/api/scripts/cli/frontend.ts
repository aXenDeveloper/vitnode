import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { FrontendCliIntegration } from "../../src/framework/cli-integration";

/** The entry `@vitnode/core` implements {@link FrontendCliIntegration} at. */
export const FRONTEND_CLI_SPECIFIER = "@vitnode/core/framework/cli";

/** The package that provides {@link FRONTEND_CLI_SPECIFIER}, for messages. */
export const FRONTEND_PACKAGE = "@vitnode/core";

export type LoadFrontendIntegration = (
  root: string,
) => Promise<FrontendCliIntegration | null>;

/**
 * The frontend integration installed for the project at `root`, or `null` when
 * it has no `@vitnode/core` - an API-only app or adapter.
 *
 * Resolved from the project, never bundled: the CLI ships in `@vitnode/api`,
 * which does not depend on `@vitnode/core`.
 */
export const loadFrontendIntegration: LoadFrontendIntegration = async root => {
  let resolved: string;
  try {
    resolved = createRequire(join(root, "package.json")).resolve(
      FRONTEND_CLI_SPECIFIER,
    );
  } catch {
    return null;
  }

  return (await import(pathToFileURL(resolved).href)) as FrontendCliIntegration;
};
