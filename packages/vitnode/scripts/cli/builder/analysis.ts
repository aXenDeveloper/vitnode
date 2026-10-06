import type { MeasuredFile } from "./output-files";

export interface Contribution {
  /** A package name, "application code" or "virtual modules". */
  label: string;
  renderedLength: number;
  /** Share of the chunk's code, 0..1. */
  share: number;
  /** `share` of the chunk's size on disk - an estimate, see below. */
  size: number;
}

export interface ChunkAnalysis {
  contributions: Contribution[];
  file: MeasuredFile;
  /** Everything outside the top contributors, or `null` when nothing is. */
  other: Contribution | null;
}

export interface AnalyzeOptions {
  /** How many chunks to break down. */
  chunks?: number;
  /** How many contributors to name per chunk before "other". */
  contributors?: number;
  owner: (moduleId: string) => string;
}

/**
 * What each package contributes to the largest client chunks.
 *
 * Built from the bundler's own metadata: every chunk lists its modules with
 * their `renderedLength` - the bytes each one contributed after tree-shaking,
 * before minification. Those lengths give each package's *share*; the size
 * shown is that share of the chunk's real size on disk, because minification
 * shrinks every module and is not reported per module. Shares are exact,
 * sizes are a close estimate.
 *
 * Returns `null` when the bundler reported no module metadata at all, so the
 * caller can say the analysis is unavailable rather than print empty tables.
 */
export const analyzeChunks = (
  files: readonly MeasuredFile[],
  { chunks = 5, contributors = 6, owner }: AnalyzeOptions,
): ChunkAnalysis[] | null => {
  const candidates = files
    .filter(file => file.category === "client-js" && file.type === "chunk")
    .sort((a, b) => b.size - a.size);

  if (!candidates.some(file => file.modules.length > 0)) return null;

  return candidates
    .filter(file => file.modules.length > 0)
    .slice(0, chunks)
    .map(file => {
      const byOwner = new Map<string, number>();
      for (const module of file.modules) {
        const label = owner(module.id);
        byOwner.set(label, (byOwner.get(label) ?? 0) + module.renderedLength);
      }

      const total = [...byOwner.values()].reduce((sum, n) => sum + n, 0);
      const toContribution = (
        label: string,
        renderedLength: number,
      ): Contribution => {
        const share = total === 0 ? 0 : renderedLength / total;

        return { label, renderedLength, share, size: share * file.size };
      };

      const sorted = [...byOwner.entries()]
        .map(([label, length]) => toContribution(label, length))
        .sort((a, b) => b.renderedLength - a.renderedLength);

      const top = sorted.slice(0, contributors);
      const rest = sorted.slice(contributors);
      const restLength = rest.reduce((sum, c) => sum + c.renderedLength, 0);

      return {
        contributions: top,
        file,
        other: rest.length === 0 ? null : toContribution("other", restLength),
      };
    });
};

/** The single largest third-party package in a chunk, if it dominates it. */
export const dominantPackage = (
  analysis: ChunkAnalysis,
  minimumShare = 0.3,
): Contribution | null =>
  analysis.contributions.find(
    c =>
      c.share >= minimumShare &&
      c.label !== "application code" &&
      c.label !== "virtual modules",
  ) ?? null;
