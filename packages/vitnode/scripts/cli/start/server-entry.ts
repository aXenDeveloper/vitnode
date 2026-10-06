import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Project } from "../project/project";

import { ConfigError } from "../errors";

export interface ServerEntry {
  defaultPort: number;
  entry: string;
}

/** Nitro presets whose output is a Node server `vitnode start` can run. */
const NODE_PRESETS = new Set(["node", "node-cluster", "node-server"]);

/**
 * The file `vitnode start` runs, as the build itself recorded it.
 *
 * For an app that is Nitro's `.output/nitro.json`, which names the server
 * entry and the preset it was built for - so a build for Vercel is refused
 * here with a reason, instead of being started as if it were a Node server.
 * For a standalone API it is the `dist/index.js` its own `tsc` build writes.
 */
export const resolveServerEntry = (project: Project): ServerEntry => {
  const notBuilt = () =>
    new ConfigError("No production build found.", {
      hint: "Run vitnode build first.",
    });

  if (project.kind === "api") {
    const entry = join(project.root, "dist", "index.js");
    if (!existsSync(entry)) throw notBuilt();

    return { defaultPort: 8000, entry };
  }

  if (project.kind === "package") {
    throw new ConfigError("A plugin package has no server to start.", {
      hint: "Run vitnode start in the app that installs it.",
    });
  }

  const output = join(project.root, ".output");
  const manifestPath = join(output, "nitro.json");

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      preset?: string;
      serverEntry?: string;
    };

    if (manifest.preset !== undefined && !NODE_PRESETS.has(manifest.preset)) {
      throw new ConfigError(
        `This build targets the "${manifest.preset}" preset, which that platform runs - not vitnode start.`,
        { hint: "Build with the node-server preset to run it yourself." },
      );
    }

    const entry = join(output, manifest.serverEntry ?? "server/index.mjs");
    if (existsSync(entry)) return { defaultPort: 3000, entry };
  }

  const fallback = join(output, "server", "index.mjs");
  if (existsSync(fallback)) return { defaultPort: 3000, entry: fallback };

  throw notBuilt();
};
