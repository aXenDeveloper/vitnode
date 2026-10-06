import { readFile, stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

import type { BuildOutputFile, MeasuredFile } from "./output-files";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

export const gzipSize = async (content: Buffer): Promise<number> =>
  content.length === 0 ? 0 : (await gzipAsync(content)).length;

/** Quality 11 - what a CDN serving precompressed static assets uses. */
export const brotliSize = async (content: Buffer): Promise<number> =>
  content.length === 0
    ? 0
    : (
        await brotliAsync(content, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
            [constants.BROTLI_PARAM_SIZE_HINT]: content.length,
          },
        })
      ).length;

/** What the browser downloads compressed: scripts and styles. */
const isCompressible = (file: BuildOutputFile) =>
  file.category === "client-js" || file.category === "css";

/** Runs `work` over `items` with at most `limit` in flight. */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );

  return results;
};

export interface MeasureOptions {
  /**
   * How many of the largest scripts and styles also get a brotli size.
   * Brotli at quality 11 is an order of magnitude slower than gzip, so it is
   * computed on request and only for the files a report actually shows.
   */
  brotli: number;
}

/**
 * Sizes every file as it is on disk.
 *
 * Read from disk rather than from the bundle in memory, because a later
 * environment (Nitro) or plugin may still rewrite what the bundler emitted, and
 * the report should describe what ships. Only client scripts and styles are
 * compressed: a server bundle is never sent over the wire, and gzipping
 * megabytes of it would only slow the build report down.
 */
export const measureFiles = async (
  files: readonly BuildOutputFile[],
  { brotli }: MeasureOptions,
): Promise<MeasuredFile[]> => {
  const concurrency = Math.max(2, availableParallelism());
  const sized = await mapWithConcurrency(files, concurrency, async file => ({
    file,
    size: (await stat(file.absolutePath)).size,
  }));

  const withBrotli = new Set(
    sized
      .filter(({ file }) => isCompressible(file))
      .sort((a, b) => b.size - a.size)
      .slice(0, brotli)
      .map(({ file }) => file),
  );

  return mapWithConcurrency(
    sized,
    concurrency,
    async ({ file, size }): Promise<MeasuredFile> => {
      if (!isCompressible(file))
        return { ...file, brotli: null, gzip: null, size };

      const content = await readFile(file.absolutePath);

      return {
        ...file,
        brotli: withBrotli.has(file) ? await brotliSize(content) : null,
        gzip: await gzipSize(content),
        size,
      };
    },
  );
};
