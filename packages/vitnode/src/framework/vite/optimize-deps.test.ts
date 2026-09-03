import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  VITNODE_CLIENT_DEPENDENCIES,
  vitNodeClientDepsInclude,
  vitNodeOptimizeDeps,
} from "./optimize-deps";

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, "../..");

const CLIENT_TREES = ["components", "hooks", "lib", "tanstack", "views", "ws"];
const SERVER_DIRECTORIES = ["api", "dist", "node_modules", "server", "tests"];
const HOST_OWNED = [
  "@tanstack/react-router",
  "@tanstack/react-start",
  "@vitnode",
  "dotenv",
  "react",
  "react-dom",
  "server-only",
];
const SPECIFIER =
  /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9-][a-z0-9-._]*(?:\/[a-z0-9-][a-z0-9-._/]*)?$/;

const filesUnder = (directory: string): string[] => {
  const files: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);

    if (statSync(path).isDirectory()) {
      if (SERVER_DIRECTORIES.includes(name)) continue;
      files.push(...filesUnder(path));
      continue;
    }

    if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) files.push(path);
  }

  return files;
};

const isTest = (path: string): boolean =>
  /\.test(-d)?\.tsx?$/.test(path) || path.includes(`${sep}tests${sep}`);

const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, "utf8")
      .replace(
        /(?:^|\n)\s*(?:import|export)\s+type\s[\s\S]*?\sfrom\s*["'][^"']+["']/g,
        "\n",
      )
      .matchAll(
        /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
      ),
  ]
    .map(match => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier));

const isHostOwned = (specifier: string): boolean =>
  HOST_OWNED.some(
    entry => specifier === entry || specifier.startsWith(`${entry}/`),
  );

const clientSpecifiers = (): string[] => {
  const found = new Set<string>();

  for (const tree of CLIENT_TREES) {
    for (const file of filesUnder(join(sourceRoot, tree)).filter(
      path => !isTest(path),
    )) {
      for (const specifier of importsFrom(file)) {
        if (specifier.startsWith(".")) continue;
        if (specifier.startsWith("@/")) continue;
        if (specifier.startsWith("node:")) continue;
        if (!SPECIFIER.test(specifier)) continue;
        if (isHostOwned(specifier)) continue;

        found.add(specifier);
      }
    }
  }

  return [...found].sort();
};

describe("VITNODE_CLIENT_DEPENDENCIES", () => {
  it("names every dependency this package's client code imports", () => {
    expect([...VITNODE_CLIENT_DEPENDENCIES]).toStrictEqual(clientSpecifiers());
  });

  it("is sorted and free of duplicates", () => {
    const entries = [...VITNODE_CLIENT_DEPENDENCIES];

    expect(entries).toStrictEqual([...new Set(entries)].sort());
  });
});

describe("vitNodeClientDepsInclude", () => {
  it("leaves a dependency the app can resolve itself bare", () => {
    const root = mkdtempSync(join(tmpdir(), "vitnode-optimize-deps-"));
    mkdirSync(join(root, "node_modules", "use-debounce"), { recursive: true });

    expect(vitNodeClientDepsInclude(root)).toContain("use-debounce");
  });

  it("resolves a dependency only this package has through this package", () => {
    const root = mkdtempSync(join(tmpdir(), "vitnode-optimize-deps-"));

    expect(vitNodeClientDepsInclude(root)).toContain(
      "@vitnode/core > recharts",
    );
  });

  it("covers every dependency exactly once", () => {
    const include = vitNodeClientDepsInclude(sourceRoot);

    expect(include).toHaveLength(VITNODE_CLIENT_DEPENDENCIES.length);
    expect(include).toContain("use-debounce");
  });
});

describe("vitNodeOptimizeDeps", () => {
  it("pre-bundles the dependencies for the dev server only", () => {
    const plugin = vitNodeOptimizeDeps();

    expect(plugin.name).toBe("vitnode:optimize-deps");
    expect(plugin.apply).toBe("serve");
  });

  it("includes the dependencies resolved from the app root", () => {
    const plugin = vitNodeOptimizeDeps();
    const config = plugin.config;

    if (typeof config !== "function") throw new Error("expected a config hook");

    const result = config.call(
      {},
      { root: sourceRoot },
      { command: "serve", mode: "development" },
    );

    expect(result).toStrictEqual({
      optimizeDeps: { include: vitNodeClientDepsInclude(sourceRoot) },
    });
  });
});
