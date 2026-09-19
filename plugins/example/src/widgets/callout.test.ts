import { widgetDataShapeIssue } from "@vitnode/core/widgets";
import { createBlockInstanceFor } from "@vitnode/core/editor/instance/defaults";
import { describe, expect, it } from "vitest";

import { calloutWidget } from "./callout";

describe("calloutWidget", () => {
  it("is renderable and saveable the moment the editor adds it", () => {
    const instance = createBlockInstanceFor({
      definition: calloutWidget,
      namespace: "example",
      pluginId: "@vitnode/example",
      type: "example:callout",
    });

    expect(instance.type).toBe("example:callout");
    expect(widgetDataShapeIssue(calloutWidget, instance.data)).toBeNull();
    expect(instance.data).toStrictEqual({
      body: "Body",
      title: "Title",
      tone: "info",
    });
  });
});
