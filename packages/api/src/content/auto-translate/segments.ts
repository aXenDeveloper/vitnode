import type { RichTextDocument, RichTextNode } from "../rich-text/document";

import { protectTokens, restoreProtectedTokens } from "./text";

/** One run of text a model translates, by its stable id. */
export interface AutoTranslateSegment {
  id: string;
  /** The text with URLs, mentions and inline code swapped for `⟦n⟧` placeholders. */
  text: string;
}

/** Segments that read as one paragraph, sent together so they translate in context. */
export interface AutoTranslateBlock {
  segments: AutoTranslateSegment[];
}

interface SegmentSlot {
  id: string;
  leading: string;
  path: number[];
  tokens: string[];
  trailing: string;
}

/** What a field value becomes before translation, and how to put it back together. */
export interface AutoTranslateSource {
  blocks: AutoTranslateBlock[];
  /** Plain text of the translatable segments, for language detection and skip rules. */
  plain: string;
  slots: SegmentSlot[];
}

const UNTRANSLATED_NODES: ReadonlySet<string> = new Set([
  "codeBlock",
  "math",
  "mathBlock",
  "mention",
]);
const UNTRANSLATED_MARKS: ReadonlySet<string> = new Set(["code"]);
const MAX_SEGMENTS = 2000;

const splitWhitespace = (text: string) => {
  const leading = /^\s*/u.exec(text)?.[0] ?? "";
  const rest = text.slice(leading.length);
  const trailing = /\s*$/u.exec(rest)?.[0] ?? "";

  return {
    core: rest.slice(0, rest.length - trailing.length),
    leading,
    trailing,
  };
};

const isLinkText = (node: RichTextNode, core: string) =>
  node.marks?.some(
    mark =>
      mark.type === "link" &&
      typeof mark.attrs?.href === "string" &&
      (mark.attrs.href === core ||
        mark.attrs.href.replace(/^\w+:\/\//u, "") === core),
  ) ?? false;

const buildSource = (
  runs: { block: number; node: RichTextNode; path: number[] }[],
): AutoTranslateSource => {
  const blocks = new Map<number, AutoTranslateBlock>();
  const slots: SegmentSlot[] = [];
  const plain: string[] = [];

  for (const run of runs) {
    const text = typeof run.node.text === "string" ? run.node.text : "";
    const { core, leading, trailing } = splitWhitespace(text);
    if (core === "" || isLinkText(run.node, core)) continue;
    if (slots.length >= MAX_SEGMENTS) break;

    const id = `s${slots.length + 1}`;
    const protectedText = protectTokens(core);
    slots.push({
      id,
      leading,
      path: run.path,
      tokens: protectedText.tokens,
      trailing,
    });
    plain.push(core);
    const block = blocks.get(run.block) ?? { segments: [] };
    block.segments.push({ id, text: protectedText.text });
    blocks.set(run.block, block);
  }

  return { blocks: [...blocks.values()], plain: plain.join(" "), slots };
};

/**
 * Splits a rich-text value into the segments a model translates: one segment
 * per text run, grouped by the block (paragraph, heading, list item) that
 * holds it. Code, mentions and
 * link text that only repeats its URL are left out, and URLs, mentions and
 * inline code inside a run become placeholders, so none of them can change.
 *
 * Browser-safe and deterministic: the same value always yields the same ids.
 */
export const autoTranslateSource = (value: unknown): AutoTranslateSource => {
  const runs: { block: number; node: RichTextNode; path: number[] }[] = [];
  let blockCounter = 0;
  const visit = (node: RichTextNode, path: number[], block: number) => {
    if (UNTRANSLATED_NODES.has(node.type)) return;
    if (node.type === "text") {
      if (!node.marks?.some(mark => UNTRANSLATED_MARKS.has(mark.type))) {
        runs.push({ block, node, path });
      }

      return;
    }
    const content = Array.isArray(node.content) ? node.content : [];
    const ownBlock = content.some(child => child.type === "text")
      ? ++blockCounter
      : block;
    content.forEach((child, index) => {
      visit(child, [...path, index], ownBlock);
    });
  };
  if (typeof value === "object" && value !== null) {
    visit(value as RichTextNode, [], 0);
  }

  return buildSource(runs);
};

/** Thrown when a model's segments cannot rebuild the original structure. */
export class AutoTranslateSegmentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutoTranslateSegmentsError";
  }
}

/**
 * Puts translated segments back into a copy of the original value. Only the
 * text of the runs that were sent changes; every node, mark, link and
 * attribute stays as it was.
 *
 * @throws {AutoTranslateSegmentsError} When a segment is missing, unknown,
 * repeated or empty, or a placeholder was lost or invented.
 */
export const applyAutoTranslateSegments = (
  value: unknown,
  source: AutoTranslateSource,
  translated: readonly AutoTranslateSegment[],
): RichTextDocument => {
  const byId = new Map<string, string>();
  for (const segment of translated) {
    if (byId.has(segment.id)) {
      throw new AutoTranslateSegmentsError(`Segment ${segment.id} repeated`);
    }
    byId.set(segment.id, segment.text);
  }
  if (byId.size !== source.slots.length) {
    throw new AutoTranslateSegmentsError("Segment count changed");
  }

  const texts = source.slots.map(slot => {
    const text = byId.get(slot.id);
    if (text === undefined || text.trim() === "") {
      throw new AutoTranslateSegmentsError(`Segment ${slot.id} missing`);
    }
    const restored = restoreProtectedTokens(text.trim(), slot.tokens);
    if (restored === null) {
      throw new AutoTranslateSegmentsError(
        `Segment ${slot.id} changed a protected token`,
      );
    }

    return `${slot.leading}${restored}${slot.trailing}`;
  });

  const copy = structuredClone(value) as RichTextDocument;
  source.slots.forEach((slot, index) => {
    let node: RichTextNode | undefined = copy;
    for (const step of slot.path) node = node?.content?.[step];
    if (node?.type !== "text") {
      throw new AutoTranslateSegmentsError(`Segment ${slot.id} has no node`);
    }
    node.text = texts[index];
  });

  return copy;
};
