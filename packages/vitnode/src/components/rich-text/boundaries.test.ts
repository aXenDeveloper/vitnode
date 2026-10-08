// @vitest-environment node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { externalGraph, reachedFiles } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

const EDITOR_ONLY =
  /^(?:@tiptap\/|prosemirror|y-|yjs$|@vitnode\/core\/components\/tiptap)/;

const entries = {
  "components/rich-text": join(here, "index.ts"),
  "content/rich-text": join(
    here,
    "..",
    "..",
    "content",
    "rich-text",
    "index.ts",
  ),
};

describe("the rich text renderer never ships the editor", () => {
  it.each(Object.entries(entries))(
    "%s reaches no Tiptap, ProseMirror or Yjs module",
    (_name, entry) => {
      const editorOnly = [...externalGraph(entry).keys()].filter(specifier =>
        EDITOR_ONLY.test(specifier),
      );

      expect(editorOnly).toStrictEqual([]);
    },
  );

  it.each(Object.entries(entries))(
    "%s reaches no file of the editor itself",
    (_name, entry) => {
      expect(
        reachedFiles(entry).filter(file =>
          file.startsWith("components/tiptap"),
        ),
      ).toStrictEqual([]);
    },
  );

  it("walks the renderer it guards", () => {
    // Otherwise the checks above would pass on a graph that stopped at the
    // entry file - which is exactly the graph that cannot break.
    expect(reachedFiles(entries["components/rich-text"])).toEqual(
      expect.arrayContaining([
        "components/rich-text/rich-text-content.tsx",
        "content/rich-text/elements.ts",
        "content/rich-text/html.ts",
      ]),
    );
  });
});
