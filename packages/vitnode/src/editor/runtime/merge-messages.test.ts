import { describe, expect, it } from "vitest";

import { mergeEditorMessages } from "./merge-messages";

describe("merging the editor's messages into the page's", () => {
  it("keeps every namespace the page already had", () => {
    const merged = mergeEditorMessages(
      { example: { zones: { title: "Settings" } } },
      { core: { editor: { save: "Save" } } },
    );

    expect(merged).toStrictEqual({
      core: { editor: { save: "Save" } },
      example: { zones: { title: "Settings" } },
    });
  });

  it("adds the editor's keys beside the page's inside a shared namespace", () => {
    const merged = mergeEditorMessages(
      { core: { global: { close: "Close" } } },
      { core: { editor: { save: "Save" } } },
    );

    expect(merged).toStrictEqual({
      core: { editor: { save: "Save" }, global: { close: "Close" } },
    });
  });

  it("lets the editor win on a key both sides define", () => {
    const merged = mergeEditorMessages(
      { core: { global: { close: "Stale" } } },
      { core: { global: { close: "Close" } } },
    );

    expect(merged).toStrictEqual({ core: { global: { close: "Close" } } });
  });

  it("leaves the page's own messages untouched", () => {
    const page = { core: { global: { close: "Close" } } };

    mergeEditorMessages(page, { core: { editor: { save: "Save" } } });

    expect(page).toStrictEqual({ core: { global: { close: "Close" } } });
  });
});
