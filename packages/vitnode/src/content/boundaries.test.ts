// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, "utf8").matchAll(
      /from\s+"([^"]+)"|import\s+"([^"]+)"/g,
    ),
  ]
    .map(match => match[1] ?? match[2])
    .filter(Boolean);

describe("layer boundaries", () => {
  const engineFiles = filesUnder(here).filter(
    path => !/\.test(-d)?\.tsx?$/.test(path),
  );

  it("has files to check", () => {
    // A refactor that moved the engine should fail loudly here rather than
    // making this suite vacuously pass.
    expect(engineFiles.length).toBeGreaterThan(10);
  });

  it.each(["next/", "server-only"])(
    "never imports %s from content/ or content/server/",
    prefix => {
      const offenders = engineFiles.filter(path =>
        importsFrom(path).some(
          specifier =>
            specifier === prefix.replace(/\/$/, "") ||
            specifier.startsWith(prefix),
        ),
      );

      expect(offenders.map(path => relative(here, path))).toEqual([]);
    },
  );

  it("keeps the Next-only layer out of the engine's import graph", () => {
    const offenders = engineFiles.filter(path =>
      importsFrom(path).some(specifier => specifier.includes("content/next")),
    );

    expect(offenders.map(path => relative(here, path))).toEqual([]);
  });

  it("has no layer left where those imports were legal", () => {
    // `content/next/` was that layer. Asserted by absence rather than dropped,
    // because the shape of the mistake this guards against is recreating it: the
    // engine's public delivery surface is `content/delivery.ts` plus the Hono
    // routes in `content/server/delivery-routes.ts`, and a host adapter over
    // them belongs in the host.
    expect(existsSync(resolve(here, "next"))).toBe(false);
  });

  it("still exposes the framework-neutral delivery surface those adapters wrapped", () => {
    // The capability, as opposed to the adapter. Deleting `content/next/` must
    // not have taken delivery resolution, SEO or the sitemap with it.
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
