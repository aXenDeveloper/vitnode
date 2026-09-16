import { describe, expect, it } from "vitest";

import { editorStatus } from "./status";

describe("the status line a sidebar footer reads", () => {
  it("reports saving while a save is in flight, even with pending edits", () => {
    expect(editorStatus(true, "saving")).toBe("saving");
  });

  it("keeps a failed save visible instead of hiding it behind the edits", () => {
    expect(editorStatus(true, "error")).toBe("error");
  });

  it("calls a page with edits unsaved once a previous save has landed", () => {
    expect(editorStatus(true, "saved")).toBe("unsaved");
  });

  it("stays on saved while nothing has changed since", () => {
    expect(editorStatus(false, "saved")).toBe("saved");
  });

  it("starts idle", () => {
    expect(editorStatus(false, "idle")).toBe("idle");
  });
});
