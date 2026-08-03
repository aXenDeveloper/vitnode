// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
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

/**
 * The layer rule the whole engine rests on, asserted rather than remembered.
 *
 * `content/` and `content/server/` are loaded by `apps/api` - a plain
 * `@hono/node-server` process - and by drizzle-kit, which executes
 * `src/database/*.ts` to read the tables. Both `next/*` and `server-only`
 * throw there, so an accidental import does not fail in CI: it fails when
 * somebody runs a migration.
 */
describe("layer boundaries", () => {
  // The client-safe core and the server layer only. `content/admin/` is
  // deliberately excluded: it is the AdminCP's own layer, it is only ever
  // reached from Next, and `fetch.server.ts` there carries `server-only` on
  // purpose. `content/next/` is excluded for the same reason.
  const engineFiles = [
    ...filesUnder(here, ["admin", "next", "server"]),
    ...filesUnder(resolve(here, "server")),
  ].filter(path => !/\.test(-d)?\.tsx?$/.test(path));

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

  it("is where the Next imports actually live", () => {
    // The other half of the rule: `content/next/` exists precisely so those
    // imports have somewhere legal to be.
    const nextFiles = filesUnder(resolve(here, "next"));
    const specifiers = nextFiles.flatMap(importsFrom);

    expect(specifiers).toContain("next/cache");
    expect(specifiers).toContain("server-only");
  });
});
