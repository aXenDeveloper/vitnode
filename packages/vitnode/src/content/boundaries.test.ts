// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { reachedFiles, SRC_ROOT } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const filesUnder = (directory: string, skip: string[] = []): string[] => {
  const entries: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      if (skip.includes(name)) continue;
      entries.push(...filesUnder(path, skip));
      continue;
    }
    if (/\.tsx?$/.test(name)) entries.push(path);
  }

  return entries;
};

describe("layer boundaries", () => {
  const engineFiles = filesUnder(here).filter(
    path => !/\.test(-d)?\.tsx?$/.test(path),
  );

  it("has files to check", () => {
    // A refactor that moved the engine should fail loudly here rather than
    // making this suite vacuously pass.
    expect(engineFiles.length).toBeGreaterThan(10);
  });

  it("exposes the framework-neutral delivery surface a host adapter wraps", () => {
    // The engine's public delivery surface is `content/delivery.ts` plus the
    // Hono routes in `content/server/delivery-routes.ts`; an adapter over them
    // belongs in the host.
    const surface = readFileSync(join(here, "index.ts"), "utf8");

    for (const name of [
      "resolveContentDelivery",
      "contentDeliverySeo",
      "contentDeliveryPath",
      "contentDeliveryRobots",
      "parseContentDeliveryPath",
    ]) {
      expect(surface).toContain(name);
    }
  });
});

describe("the engine's server half and the browser editor stay apart", () => {
  it("never reaches a file under the visual editor", () => {
    const reached = reachedFiles(join(here, "server", "index.ts"), {
      srcRoot: SRC_ROOT,
    }).filter(file => file.startsWith("editor/"));

    expect(reached).toStrictEqual([]);
  });
});
