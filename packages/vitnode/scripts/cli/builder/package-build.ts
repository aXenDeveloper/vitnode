import type { FSWatcher } from "node:fs";
import type { InlineConfig, Logger, Rolldown, TsdownHandle } from "tsdown";

import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  watch,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { format } from "node:util";

import { toDisplayPath } from "../ui/format";

/**
 * How VitNode builds a plugin or adapter package with tsdown.
 *
 * Every package is built the same way, so there is no `tsdown.config.ts` to
 * write: each TypeScript module under `src` is compiled on its own (unbundle
 * mode) into `dist/src`, next to its `.d.ts`, because a package's wildcard
 * exports (`"./*": "./dist/src/*.js"`) make every module public - not only the
 * ones an `index.ts` happens to import.
 */

export type PackageBuildMode = "build" | "watch";

/**
 * Which part of `dist/src` one tsdown build writes.
 *
 * A production build writes `all` in one pass. Watch mode runs two builds side
 * by side: `javascript`, rebuilt in milliseconds on every save - what an app
 * reloads - and `declarations`, which waits on the TypeScript compiler and so
 * must not hold the JavaScript back.
 */
export type PackageOutput = "all" | "declarations" | "javascript";

/** The tsdown API the CLI uses, loaded from the package being built. */
export interface TsdownApi {
  build: (config: InlineConfig) => Promise<TsdownHandle>;
}

export const PACKAGE_OUT_DIR = "dist";
export const PACKAGE_TSCONFIG = "tsconfig.build.json";
/** The only folder a package build writes to, and the only one it prunes. */
const OUTPUT_ROOT = "src";

/** Tests, type tests and their fixtures never reach `dist`. */
const isTestPath = (path: string): boolean =>
  /\.test(?:-d)?\.[cm]?[jt]sx?$/.test(path) ||
  path.startsWith("src/tests/") ||
  /(?:^|\/)__(?:tests|fixtures)__\//.test(path);

/** Compiled into `dist`; everything else under `src` is copied as it is. */
const SCRIPT = /\.[cm]?[jt]sx?$/;
const DECLARATION = /\.d\.[cm]?ts$/;
const DECLARATION_OUTPUT = /\.d\.[cm]?ts(?:\.map)?$/;

const ownsFile = (output: PackageOutput, fileName: string): boolean =>
  output === "all" ||
  (output === "declarations") === DECLARATION_OUTPUT.test(fileName);

/** Every file under `dir`, skipping dotfiles and dot-folders. */
const walk = (dir: string, visit: (path: string) => void) => {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path);
  }
};

const listSourceFiles = (root: string) => {
  const files: string[] = [];
  walk(join(root, OUTPUT_ROOT), path => {
    const file = toDisplayPath(relative(root, path));
    if (!isTestPath(file)) files.push(file);
  });

  return files.sort();
};

/**
 * Every module a package build compiles, e.g. `src/routes.ts`: each `.ts` and
 * `.tsx` file under `src` except declarations and tests.
 *
 * All of them, not only what an `index.ts` imports: the package's wildcard
 * exports make each one public.
 */
export const listPackageEntries = (root: string): string[] =>
  listSourceFiles(root).filter(
    file => /\.tsx?$/.test(file) && !DECLARATION.test(file),
  );

/**
 * The files under `src` a package ships as they are - locale JSON, CSS, email
 * images - as paths relative to the package, e.g. `src/locales/en.json`.
 *
 * Compiled modules import them relative to themselves
 * (`import("./en.json", { with: { type: "json" } })`), so each one is copied to
 * the same place under `dist`.
 */
export const listPackageAssets = (root: string): string[] =>
  listSourceFiles(root).filter(file => !SCRIPT.test(file));

const isRelative = (specifier: string) =>
  specifier.startsWith("./") || specifier.startsWith("../");

const contentOf = (output: Rolldown.OutputAsset | Rolldown.OutputChunk) =>
  output.type === "chunk" ? output.code : output.source;

const sameAsOnDisk = (path: string, content: string | Uint8Array) => {
  if (!existsSync(path)) return false;
  const current = readFileSync(path);
  const next = typeof content === "string" ? Buffer.from(content) : content;

  return current.length === next.length && current.equals(next);
};

/**
 * Deletes every file under `dir` this build owns but did not produce, then
 * empty folders. A file the other watch build owns is never touched.
 */
const prune = (
  outDir: string,
  dir: string,
  keep: ReadonlySet<string>,
  owns: (fileName: string) => boolean,
) => {
  walk(join(outDir, dir), path => {
    const fileName = toDisplayPath(relative(outDir, path));
    if (owns(fileName) && !keep.has(fileName)) rmSync(path);
  });

  const removeEmpty = (current: string): boolean => {
    let empty = true;
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory() && removeEmpty(path)) continue;
      empty = false;
    }
    if (empty && current !== join(outDir, dir)) rmdirSync(current);

    return empty;
  };

  if (existsSync(join(outDir, dir))) removeEmpty(join(outDir, dir));
};

const SOURCE_MAP_COMMENT = /\n?\/\/# sourceMappingURL=\S+\s*$/;

/**
 * What VitNode adds on top of tsdown's own output:
 *
 * - Asset imports (`./en.json`, `./styles.css`) stay imports, and the files
 *   themselves are copied next to the compiled module.
 * - Only files whose content changed are written, so an app watching `dist`
 *   reloads for the module that changed - not for every file in the package.
 * - Files under `dist/src` the build no longer produces are deleted after a
 *   successful build, which handles deleted and renamed sources without ever
 *   emptying `dist` first. Nothing outside `dist/src` is touched, and a build
 *   writing one part of the output never deletes the other part.
 * - Production builds ship declaration maps, but not JavaScript source maps:
 *   tsdown emits both together, and the JavaScript ones are dropped here.
 */
export const packageOutputPlugin = ({
  output = "all",
  root,
  sourcemaps,
}: {
  output?: PackageOutput;
  root: string;
  sourcemaps: boolean;
}): Rolldown.Plugin => ({
  buildStart() {
    if (output === "declarations") return;
    for (const asset of listPackageAssets(root)) {
      this.addWatchFile(join(root, asset));
    }
  },
  generateBundle: {
    handler(options, bundle) {
      const outDir = options.dir ?? join(root, PACKAGE_OUT_DIR);

      if (output !== "declarations") {
        for (const asset of listPackageAssets(root)) {
          this.emitFile({
            fileName: asset,
            source: readFileSync(join(root, asset)),
            type: "asset",
          });
        }
      }

      if (!sourcemaps) {
        for (const file of Object.values(bundle)) {
          if (file.type !== "chunk" || DECLARATION.test(file.fileName))
            continue;
          file.code = file.code.replace(SOURCE_MAP_COMMENT, "\n");
          delete bundle[`${file.fileName}.map`];
        }
      }

      const produced = new Set(Object.keys(bundle));

      for (const [fileName, file] of Object.entries(bundle)) {
        if (sameAsOnDisk(join(outDir, fileName), contentOf(file))) {
          delete bundle[fileName];
        }
      }

      prune(outDir, OUTPUT_ROOT, produced, fileName =>
        ownsFile(output, fileName),
      );
    },
    order: "post",
  },
  name: "vitnode:package-output",
  resolveId(source, importer) {
    if (importer === undefined || !isRelative(source)) return null;
    // Only a file that exists under exactly that name: `./hello.module` names
    // `hello.module.ts`, a module, even though it reads like an extension.
    const path = resolve(dirname(importer), source.split("?")[0]);
    if (SCRIPT.test(path) || !existsSync(path) || !statSync(path).isFile())
      return null;

    return { external: true, id: source };
  },
});

/**
 * A tsdown logger that keeps only what a developer acts on.
 *
 * tsdown's own lists every entry it compiles - over a thousand for core - and
 * clears the screen on each rebuild, which would wipe the type checker's output
 * running in the same terminal.
 */
export const createPackageLogger = (
  write: (type: "error" | "info" | "warn", message: string) => void,
): Logger => {
  // tsdown passes its config's name label first, `undefined` when unnamed.
  const text = (messages: unknown[]) =>
    messages
      .filter(message => message !== undefined)
      .map(message =>
        message instanceof Error ? message.message : format(message),
      )
      .join(" ");
  const warned = new Set<string>();

  return {
    clearScreen: () => undefined,
    error: (...messages: unknown[]) => {
      write("error", text(messages));
    },
    info: (...messages: unknown[]) => {
      const message = text(messages);
      if (/^(?:entry|target|tsconfig): /.test(message)) return;
      write("info", message);
    },
    level: "info",
    success: (...messages: unknown[]) => {
      write("info", text(messages));
    },
    warn: (...messages: unknown[]) => {
      write("warn", text(messages));
    },
    warnOnce: (...messages: unknown[]) => {
      const message = text(messages);
      if (warned.has(message)) return;
      warned.add(message);
      write("warn", message);
    },
  };
};

/**
 * The one tsdown configuration every VitNode package is built with.
 *
 * - `unbundle` with `root: "."`: one output file per source module, keeping
 *   the `dist/src/` prefix the package's exports point at.
 * - Every package import stays external, exactly as written - React, Hono,
 *   Drizzle, `@vitnode/core`, workspace packages and dev dependencies alike. A
 *   package's dependencies belong to the app that installs it.
 * - `@/` aliases are resolved through `tsconfig.build.json`, in the JavaScript
 *   and in the declarations, so no alias-rewriting pass runs afterwards.
 * - Declarations come from the TypeScript compiler (no `isolatedDeclarations`),
 *   with every file the tsconfig includes - `global.d.ts` and the generated
 *   `types/api-registry.gen.d.ts` among them - so inferred types such as a
 *   fetcher's response come out the same as `tsc` would emit them.
 * - No tree shaking, no `import.meta.glob` expansion and an `esnext` target:
 *   modules keep their side effects and syntax, and the app's bundler does the
 *   rest, as it did with SWC.
 */
export const packageTsdownConfig = ({
  logger,
  mode,
  output = "all",
  root,
}: {
  logger: Logger;
  mode: PackageBuildMode;
  output?: PackageOutput;
  root: string;
}): InlineConfig => ({
  checks: { bundlerTimings: false },
  clean: false,
  config: false,
  customLogger: logger,
  cwd: root,
  deps: { neverBundle: true },
  dts:
    output === "javascript"
      ? false
      : { eager: true, emitDtsOnly: output === "declarations" },
  entry: listPackageEntries(root),
  fixedExtension: false,
  format: "esm",
  globImport: false,
  inputOptions: options => ({
    ...options,
    transform: { ...options.transform, jsx: "react-jsx" },
  }),
  logLevel: "warn",
  minify: mode === "build",
  outDir: PACKAGE_OUT_DIR,
  // The helper rolldown emits for `import * as ns` stays inside `dist/src`.
  outputOptions: options => ({
    ...options,
    virtualDirname: `${OUTPUT_ROOT}/_virtual`,
  }),
  platform: "neutral",
  plugins: [
    packageOutputPlugin({ output, root, sourcemaps: mode === "watch" }),
  ],
  report: false,
  root: ".",
  sourcemap: mode === "watch",
  target: "esnext",
  treeshake: false,
  tsconfig: PACKAGE_TSCONFIG,
  unbundle: true,
  watch: mode === "watch",
});

/** How long `watchPackage` waits for a burst of file changes - a branch switch - to settle. */
const SETTLE_MS = 200;

/**
 * One part of a package's output in watch mode, kept running across changes
 * to the set of files under `src`.
 *
 * tsdown rebuilds on every edit by itself. A file added or deleted is
 * different: the entries are fixed when a build starts, so the build is
 * replaced with one over the new list. tsdown can restart itself on a glob
 * entry, but it re-reads the glob while its new watcher is not yet listening,
 * and a file deleted in between leaves it failing on a missing entry until the
 * next change - this watches `src` on its own instead, without gaps, and
 * checks the list again after every start.
 */
export const watchPackage = async ({
  logger,
  output,
  root,
  tsdown,
}: {
  logger: Logger;
  output: PackageOutput;
  root: string;
  tsdown: TsdownApi;
}): Promise<{ close: () => Promise<void> }> => {
  const sources = () =>
    JSON.stringify([listPackageEntries(root), listPackageAssets(root)]);
  // A deleted module fails the running build on its missing entry a moment
  // before the restart below replaces it - an error nobody has to act on.
  const quiet: Logger = {
    ...logger,
    error: (...messages: unknown[]) => {
      const text = messages
        .map(message => (message instanceof Error ? message.message : message))
        .join(" ");
      if (!text.includes("UNRESOLVED_ENTRY")) logger.error(...messages);
    },
  };
  let current: null | TsdownHandle = null;
  let built = "";
  let closed = false;

  const sync = async () => {
    while (!closed && sources() !== built) {
      built = sources();
      await current?.watch.close();
      current = null;
      if (closed) return;
      current = await tsdown.build(
        packageTsdownConfig({ logger: quiet, mode: "watch", output, root }),
      );
    }
  };

  // Every restart runs after the previous one, so two never overlap.
  let pending: Promise<void> = Promise.resolve();
  let timer: NodeJS.Timeout | undefined;
  const watcher: FSWatcher = watch(
    join(root, OUTPUT_ROOT),
    { recursive: true },
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        pending = pending.then(sync).catch((error: unknown) => {
          quiet.error(error);
        });
      }, SETTLE_MS);
    },
  );

  try {
    await sync();
  } catch (error) {
    watcher.close();
    throw error;
  }

  return {
    close: async () => {
      closed = true;
      clearTimeout(timer);
      watcher.close();
      await pending;
      await current?.watch.close();
    },
  };
};
