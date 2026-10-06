import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { PackageJson } from "./project/packages";

/**
 * `@vitnode/core`'s own `package.json` - the CLI's version, and the versions
 * a generated plugin depends on.
 *
 * Found by walking up from this module rather than by a fixed `../..`, because
 * the same code runs from `scripts/` in tests and from a bundled chunk in
 * `dist/scripts/` once published.
 */
export const readCoreManifest = (
  from: string = import.meta.url,
): null | PackageJson => {
  let current = dirname(fileURLToPath(from));

  for (;;) {
    const manifest = join(current, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as PackageJson;
      if (parsed.name === "@vitnode/core") return parsed;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

export const readCliVersion = (from?: string): string =>
  readCoreManifest(from)?.version ?? "0.0.0";
