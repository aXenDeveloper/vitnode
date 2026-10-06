import type { ChunkAnalysis } from "./analysis";
import type { FileCategory, MeasuredFile } from "./output-files";
import type { SizeSeverity } from "./size-severity";

import { formatBytes, formatPercent } from "../ui/format";
import { dominantPackage } from "./analysis";
import { classifySize, needsWarning, SIZE_THRESHOLDS } from "./size-severity";

export interface BuildWarning {
  files: { name: string; size: number }[];
  severity: SizeSeverity;
  suggestions: string[];
  title: string;
}

const SUGGESTIONS: Partial<Record<FileCategory, string[]>> = {
  asset: [
    "compress it, or convert images to WebP or AVIF",
    "serve large media from storage instead of bundling it",
  ],
  "client-js": [
    "load heavy libraries with dynamic import() where they are used",
    "give pages their own chunk: component: lazy(() => import(...)) in routes.ts",
    "lazy-load heavy UI such as editors and dialogs with React.lazy + Suspense",
  ],
  css: [
    "check that Tailwind only scans the sources it needs",
    "move page-specific styles next to the page so they split with it",
  ],
};

const NOUN: Record<FileCategory, string> = {
  asset: "asset",
  "client-js": "client chunk",
  css: "stylesheet",
  other: "file",
  server: "server file",
};

const MAX_LISTED = 5;

/**
 * Concise, actionable warnings about oversized output.
 *
 * Grouped by category and severity, so twelve oversized chunks are one warning
 * listing the largest five rather than twelve copies of the same advice. When
 * `--analyze` found a single package dominating a flagged chunk, that becomes
 * the first suggestion: it is the most specific thing VitNode can say.
 */
export const collectWarnings = (
  files: readonly MeasuredFile[],
  analyses: readonly ChunkAnalysis[] = [],
): BuildWarning[] => {
  const groups = new Map<string, MeasuredFile[]>();

  for (const file of files) {
    const severity = classifySize(file.category, file.size);
    if (!needsWarning(file.category, severity)) continue;

    const key = `${file.category}:${severity}`;
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }

  const order: SizeSeverity[] = ["large", "warning"];

  return [...groups.entries()]
    .map(([key, grouped]) => {
      const [category, severity] = key.split(":") as [
        FileCategory,
        SizeSeverity,
      ];
      const sorted = [...grouped].sort((a, b) => b.size - a.size);
      const limit =
        severity === "large"
          ? SIZE_THRESHOLDS[category].warning
          : SIZE_THRESHOLDS[category].normal;
      const noun = NOUN[category];
      const subject =
        sorted.length === 1
          ? `${baseName(sorted[0].fileName)} is`
          : `${String(sorted.length)} ${noun}s are`;

      const dominant = analyses
        .filter(analysis => sorted.some(file => file === analysis.file))
        .map(analysis => ({ analysis, top: dominantPackage(analysis) }))
        .find(({ top }) => top !== null);

      const suggestions = [
        ...(dominant?.top
          ? [
              `${dominant.top.label} makes up ${formatPercent(dominant.top.share)} of ${baseName(dominant.analysis.file.fileName)} - import it with import() where it is needed`,
            ]
          : []),
        ...(SUGGESTIONS[category] ?? []),
      ];

      return {
        files: sorted
          .slice(0, MAX_LISTED)
          .map(file => ({ name: file.fileName, size: file.size })),
        severity,
        suggestions,
        title: `${subject} larger than the recommended ${formatBytes(limit)} for a ${noun}.`,
      } satisfies BuildWarning;
    })
    .sort(
      (a, b) =>
        order.indexOf(a.severity) - order.indexOf(b.severity) ||
        b.files[0].size - a.files[0].size,
    );
};

const baseName = (fileName: string) =>
  fileName.slice(fileName.lastIndexOf("/") + 1);
