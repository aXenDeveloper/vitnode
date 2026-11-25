import type {
  RichTextDocument,
  RichTextNode,
} from "@/content/rich-text/document";

/** How one block changed between two versions. */
export type LegalDiffKind = "added" | "changed" | "removed" | "unchanged";

/**
 * One block of a comparison. Each side is a self-contained node that renders
 * on its own: a list item comes wrapped in its list.
 */
export interface LegalDiffBlock {
  after: null | RichTextNode;
  before: null | RichTextNode;
  kind: LegalDiffKind;
}

export interface LegalDiffResult {
  blocks: LegalDiffBlock[];
  stats: { added: number; changed: number; removed: number };
}

const LIST_TYPES: ReadonlySet<string> = new Set([
  "bulletList",
  "orderedList",
  "taskList",
]);

/** Above this many cells the LCS falls back to a positional comparison. */
const MAX_LCS_CELLS = 4_000_000;

/**
 * Splits a document into comparable blocks: top-level nodes, with each list
 * item as its own block (wrapped in a one-item list of the same type).
 * Browser-safe.
 */
export const legalDiffBlocksOf = (
  doc: null | RichTextDocument | undefined,
): RichTextNode[] => {
  const blocks: RichTextNode[] = [];

  for (const node of doc?.content ?? []) {
    if (LIST_TYPES.has(node.type) && Array.isArray(node.content)) {
      for (const item of node.content) {
        blocks.push({ ...node, content: [item] });
      }
      continue;
    }
    blocks.push(node);
  }

  return blocks;
};

const keyOf = (node: RichTextNode): string => JSON.stringify(node);

/** Longest common subsequence of two key lists, as index pairs in order. */
const lcsPairs = (before: string[], after: string[]): [number, number][] => {
  const n = before.length;
  const m = after.length;

  if (n * m > MAX_LCS_CELLS) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < Math.min(n, m); i++) {
      if (before[i] === after[i]) pairs.push([i, i]);
    }

    return pairs;
  }

  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        before[i] === after[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(
              table[(i + 1) * width + j] ?? 0,
              table[i * width + j + 1] ?? 0,
            );
    }
  }

  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (
      (table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)
    ) {
      i++;
    } else {
      j++;
    }
  }

  return pairs;
};

/**
 * Compares two documents block by block (paragraphs, headings, list items,
 * tables). Blocks that only exist on one side are `added` or `removed`; a run
 * of removals followed by a run of additions at the same place is paired up
 * as `changed`, in order. Pass `null` as `before` for a first version: every
 * block is then `added`. Pure and browser-safe.
 */
export const diffLegalDocuments = (
  before: null | RichTextDocument | undefined,
  after: RichTextDocument,
): LegalDiffResult => {
  const oldBlocks = legalDiffBlocksOf(before);
  const newBlocks = legalDiffBlocksOf(after);
  const pairs = lcsPairs(oldBlocks.map(keyOf), newBlocks.map(keyOf));
  const blocks: LegalDiffBlock[] = [];
  const stats = { added: 0, changed: 0, removed: 0 };

  const flush = (removed: RichTextNode[], added: RichTextNode[]) => {
    const paired = Math.min(removed.length, added.length);
    for (let k = 0; k < paired; k++) {
      blocks.push({
        after: added[k] ?? null,
        before: removed[k] ?? null,
        kind: "changed",
      });
      stats.changed++;
    }
    for (const node of removed.slice(paired)) {
      blocks.push({ after: null, before: node, kind: "removed" });
      stats.removed++;
    }
    for (const node of added.slice(paired)) {
      blocks.push({ after: node, before: null, kind: "added" });
      stats.added++;
    }
  };

  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [oldBlocks.length, newBlocks.length]]) {
    flush(oldBlocks.slice(i, pi), newBlocks.slice(j, pj));
    const same = newBlocks[pj];
    if (same)
      blocks.push({
        after: same,
        before: oldBlocks[pi] ?? same,
        kind: "unchanged",
      });
    i = pi + 1;
    j = pj + 1;
  }

  return { blocks, stats };
};
