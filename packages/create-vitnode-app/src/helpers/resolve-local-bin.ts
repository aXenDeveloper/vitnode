import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * The path to a binary a package manager has just installed, or `null`.
 *
 * Walks up from `from` looking for `node_modules/.bin/<name>`, which is where
 * pnpm (beside the app) and npm and bun (hoisted to the workspace root) all put
 * it.
 *
 * Resolved rather than asked of the package manager, because the three of them
 * do not agree on how to run one. `pnpm vitnode …` and `bun vitnode …` both
 * work; `npm vitnode …` is "Unknown command", so every npm project generated
 * with `--install` failed its migration generation and the CLI reported the
 * project as created-but-broken. An absolute path needs no exec subcommand, no
 * PATH and no shell.
 *
 * Pure given `exists`, so the walk can be tested without a `node_modules`.
 */
export const resolveLocalBin = (
  name: string,
  from: string,
  { exists = existsSync, win32 = process.platform === "win32" } = {},
): null | string => {
  const binary = win32 ? `${name}.cmd` : name;

  for (
    let current = resolve(from), parent = dirname(current);
    ;
    current = parent, parent = dirname(current)
  ) {
    const candidate = join(current, "node_modules", ".bin", binary);

    if (exists(candidate)) return candidate;
    if (parent === current) return null;
  }
};
