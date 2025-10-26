import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PackageJSON } from "./packages-json.js";

export const getPackageManagerFromRoot = (rootPath: string): string => {
  try {
    const packageJsonPath = join(rootPath, "package.json");
    const packageJson: PackageJSON = JSON.parse(
      readFileSync(packageJsonPath, "utf-8"),
    );

    if (packageJson.packageManager) {
      // Extract package manager name from "pnpm@10.18.3" -> "pnpm"
      return packageJson.packageManager.split("@")[0];
    }

    return "npm";
  } catch {
    return "npm";
  }
};
