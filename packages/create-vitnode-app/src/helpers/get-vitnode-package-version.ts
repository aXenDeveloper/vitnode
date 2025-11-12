import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import type { PackageJSON } from "./packages-json.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getVitnodePackageVersion = async () => {
  // Resolve local version of @vitnode/* based on this CLI's package.json
  const cliPkg: PackageJSON = JSON.parse(
    await readFile(join(__dirname, "..", "..", "..", "package.json"), "utf-8"),
  );

  return `^${cliPkg.version}`;
};
