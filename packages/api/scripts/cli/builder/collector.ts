import type { Plugin } from "vite";

import { dirname, isAbsolute, join, relative, sep } from "node:path";

import type { BuildOutputFile, ChunkModule, Consumer } from "./output-files";

import { toDisplayPath } from "../ui/format";
import {
  categorize,
  dedupeKeys,
  isReportedFile,
  logicalKey,
} from "./output-files";

export interface EnvironmentInfo {
  consumer: Consumer;
  name: string;
}

export interface EnvironmentRecord extends EnvironmentInfo {
  files: BuildOutputFile[];
  /**
   * Written somewhere under `node_modules` - an intermediate step another
   * environment consumes (TanStack Start's SSR bundle, which Nitro then
   * packages), not something that ships.
   */
  intermediate: boolean;
  outDir: null | string;
}

export interface CollectorEvents {
  onEnd: (environment: EnvironmentInfo, error?: unknown) => void;
  onStart: (environment: EnvironmentInfo) => void;
}

/** The parts of a Rolldown/Rollup output entry the report reads. */
interface OutputEntry {
  facadeModuleId?: null | string;
  fileName: string;
  isEntry?: boolean;
  modules?: Record<string, { renderedLength: number }>;
  name?: string;
  originalFileNames?: readonly string[];
  type: "asset" | "chunk";
}

interface HookContext {
  environment?: { config: { consumer?: Consumer }; name: string };
}

const infoOf = (context: HookContext): EnvironmentInfo => ({
  consumer: context.environment?.config.consumer ?? "client",
  name: context.environment?.name ?? "client",
});

const isUnderNodeModules = (dir: string) =>
  dir.split(sep).includes("node_modules") || dir.includes("/node_modules/");

/**
 * A Vite plugin that watches the build instead of changing it.
 *
 * Added to the app's own Vite config for the duration of `vitnode build`. It
 * reports when each environment starts and finishes - which is what the
 * progress lines are made of, so they name the environments the app really
 * has - and records every file each one wrote together with the module
 * metadata the bundler already computed. Nothing is parsed back out of the
 * output.
 */
export const createBuildCollector = (root: string, events: CollectorEvents) => {
  const environments = new Map<string, EnvironmentRecord>();
  const ended = new Set<string>();

  const recordFor = (info: EnvironmentInfo): EnvironmentRecord => {
    const existing = environments.get(info.name);
    if (existing !== undefined) return existing;

    const record: EnvironmentRecord = {
      ...info,
      files: [],
      intermediate: false,
      outDir: null,
    };
    environments.set(info.name, record);

    return record;
  };

  const end = (info: EnvironmentInfo, error?: unknown) => {
    if (ended.has(info.name)) return;
    ended.add(info.name);
    events.onEnd(info, error);
  };

  const plugin: Plugin = {
    // Report on the bundle exactly as the app's plugins left it.
    enforce: "post",
    name: "vitnode:build-report",

    buildStart(this: HookContext) {
      const info = infoOf(this);
      recordFor(info);
      ended.delete(info.name);
      events.onStart(info);
    },

    buildEnd(this: HookContext, error?: Error) {
      if (error !== undefined) end(infoOf(this), error);
    },

    writeBundle(
      this: HookContext,
      options: { dir?: string; file?: string },
      bundle: Record<string, OutputEntry>,
    ) {
      const info = infoOf(this);
      const record = recordFor(info);
      const outDir =
        options.dir ?? (options.file ? dirname(options.file) : root);
      const absoluteDir = isAbsolute(outDir) ? outDir : join(root, outDir);

      record.outDir = absoluteDir;
      record.intermediate = isUnderNodeModules(relative(root, absoluteDir));

      const files = Object.values(bundle)
        .filter(entry => isReportedFile(entry.fileName))
        .map((entry): BuildOutputFile => {
          const modules: ChunkModule[] =
            entry.type === "chunk"
              ? Object.entries(entry.modules ?? {}).map(([id, module]) => ({
                  id,
                  renderedLength: module.renderedLength,
                }))
              : [];
          const absolutePath = join(absoluteDir, entry.fileName);

          return {
            absolutePath,
            category: categorize(entry.fileName, info.consumer),
            consumer: info.consumer,
            displayPath: toDisplayPath(relative(root, absolutePath)),
            environment: info.name,
            fileName: toDisplayPath(entry.fileName),
            isEntry: entry.isEntry === true,
            key: logicalKey(
              {
                environment: info.name,
                facadeModuleId: entry.facadeModuleId,
                fileName: entry.fileName,
                modules,
                name: entry.name,
                originalFileNames: entry.originalFileNames,
                type: entry.type,
              },
              root,
            ),
            modules,
            type: entry.type,
          };
        });

      record.files = dedupeKeys([...record.files, ...files]);
    },

    closeBundle(this: HookContext) {
      end(infoOf(this));
    },
  };

  return { environments, plugin };
};
