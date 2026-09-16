import { blockDataShapeIssue } from "@vitnode/core/blocks";
import { createBlockInstanceFor } from "@vitnode/core/editor/instance/defaults";
import { describe, expect, it } from "vitest";

import { calloutBlock } from "./callout";

describe("calloutBlock", () => {
  it("is renderable and saveable the moment the editor adds it", () => {
    const instance = createBlockInstanceFor({
      definition: calloutBlock,
      namespace: "example",
      pluginId: "@vitnode/example",
      type: "example:callout",
    });

    expect(instance.type).toBe("example:callout");
    expect(blockDataShapeIssue(calloutBlock, instance.data)).toBeNull();
    expect(instance.data).toStrictEqual({
      body: "Body",
      title: "Title",
      tone: "info",
    });
  });
});
