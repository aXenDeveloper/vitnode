import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import type { PackageJson } from "./packages";

import { ConfigError } from "../errors";
import { findPackageRoot, readPackageJson } from "./packages";

/**
 * What the current directory is, as far as `dev`, `build` and `start` care.
 *
 * - `app` - a TanStack Start application, built and served by Vite.
 * - `api` - a standalone Hono API, compiled by `tsc` and run by Node.
 * - `package` - a plugin or adapter package, compiled by tsdown into `dist`
 *   for apps to import. This is what `vitnode build` and `vitnode dev` have always meant
 *   inside one, and they still do.
 */
export type ProjectKind = "api" | "app" | "package";

export interface Project {
  /** The Drizzle config, when this project owns a database schema. */
  drizzleConfig: null | string;
  /** `src/vitnode.api.config.ts`, when this project serves the API. */
  hasApi: boolean;
  kind: ProjectKind;
  name: string;
  packageJson: PackageJson;
  root: string;
  viteConfig: null | string;
}

const VITE_CONFIGS = [
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cts",
  "vite.config.cjs",
];

const DRIZZLE_CONFIGS = [
  "drizzle.config.ts",
  "drizzle.config.mts",
  "drizzle.config.js",
  "drizzle.config.mjs",
];

/** The Drizzle config a project uses, whichever extension it chose. */
export const findDrizzleConfig = (root: string): null | string =>
  firstExisting(root, DRIZZLE_CONFIGS);

const firstExisting = (root: string, files: readonly string[]) => {
  const found = files.find(file => existsSync(join(root, file)));

  return found === undefined ? null : join(root, found);
};

/**
 * Whether a package's `exports` point into `dist/src` - the folder `vitnode
 * build` writes. Together with `tsconfig.build.json` that is what makes a
 * folder a VitNode package; a tool that only compiles with `tsc` (as
 * `create-vitnode-app` does) exports nothing from there.
 */
const exportsBuildOutput = (exports: unknown): boolean => {
  if (typeof exports === "string") return exports.startsWith("./dist/src/");
  if (exports === null || typeof exports !== "object") return false;

  return Object.values(exports).some(exportsBuildOutput);
};

export const kindOf = (root: string): null | ProjectKind => {
  if (firstExisting(root, VITE_CONFIGS) !== null) return "app";
  if (existsSync(join(root, "src", "vitnode.api.config.ts"))) return "api";
  if (
    existsSync(join(root, "tsconfig.build.json")) &&
    exportsBuildOutput(readPackageJson(root)?.exports)
  ) {
    return "package";
  }

  return null;
};

const isWorkspaceRoot = (root: string, manifest: PackageJson) =>
  manifest.workspaces !== undefined ||
  existsSync(join(root, "pnpm-workspace.yaml")) ||
  existsSync(join(root, "turbo.json"));

export const detectProject = (cwd: string): Project => {
  const root = findPackageRoot(cwd);
  const packageJson = root === null ? null : readPackageJson(root);

  if (root === null || packageJson === null) {
    throw new ConfigError(`No package.json found in ${cwd} or above it.`, {
      hint: "Run VitNode commands from inside a VitNode app or plugin.",
    });
  }

  const kind = kindOf(root);

  if (kind === null) {
    throw new ConfigError(
      `${relative(cwd, root) || "This directory"} is not a VitNode app, API or plugin package.`,
      {
        details: [
          "An app has a vite.config.ts, an API has src/vitnode.api.config.ts,",
          "and a plugin package has tsconfig.build.json and exports from ./dist/src/.",
        ],
        hint: isWorkspaceRoot(root, packageJson)
          ? "This is a workspace root - run the command inside one of its apps, e.g. cd apps/web."
          : undefined,
      },
    );
  }

  return {
    drizzleConfig: firstExisting(root, DRIZZLE_CONFIGS),
    hasApi: existsSync(join(root, "src", "vitnode.api.config.ts")),
    kind,
    name: packageJson.name ?? relative(cwd, root),
    packageJson,
    root,
    viteConfig: firstExisting(root, VITE_CONFIGS),
  };
};

/** The project, insisting that it owns a database. */
export const requireDatabaseProject = (
  cwd: string,
): Project & {
  drizzleConfig: string;
} => {
  const root = findPackageRoot(cwd) ?? cwd;
  const drizzleConfig = firstExisting(root, DRIZZLE_CONFIGS);
  const packageJson = readPackageJson(root);

  if (drizzleConfig === null || packageJson === null) {
    throw new ConfigError(
      "This project does not own a database: no drizzle.config.ts was found.",
      {
        hint: "Run database commands in the app that owns the schema - the API app, or a single app that mounts the API.",
      },
    );
  }

  return {
    drizzleConfig,
    hasApi: existsSync(join(root, "src", "vitnode.api.config.ts")),
    kind: kindOf(root) ?? "api",
    name: packageJson.name ?? root,
    packageJson,
    root,
    viteConfig: firstExisting(root, VITE_CONFIGS),
  };
};
