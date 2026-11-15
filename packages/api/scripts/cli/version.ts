import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { PackageJson } from "./project/packages";

/** The package that ships the `vitnode` executable. */
export const CLI_PACKAGE = "@vitnode/api";

/**
 * `@vitnode/api`'s own `package.json` - the package that ships the CLI, so
 * its version is the CLI's. `@vitnode/core` is released with the same version.
 *
 * Found by walking up from this module rather than by a fixed `../..`, because
 * the same code runs from `scripts/` in tests and from a bundled chunk in
 * `dist/scripts/` once published.
 */
export const readCliManifest = (
  from: string = import.meta.url,
): null | PackageJson => {
  let current = dirname(fileURLToPath(from));

  for (;;) {
    const manifest = join(current, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as PackageJson;
      if (parsed.name === CLI_PACKAGE) return parsed;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

export const readCliVersion = (from?: string): string =>
  readCliManifest(from)?.version ?? "0.0.0";
