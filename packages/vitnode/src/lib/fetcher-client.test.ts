import type { BaseBuildModuleReturn } from "@/api/lib/module";

import { describe, expect, it } from "vitest";

import { clientModule } from "./fetcher-client";

describe("clientModule", () => {
  it("returns a stub carrying only the pluginId the fetcher reads at runtime", () => {
    const ref = clientModule<BaseBuildModuleReturn>("@my-plugin/core");

    expect(ref.pluginId).toBe("@my-plugin/core");
    expect(Object.keys(ref)).toEqual(["pluginId"]);
  });
});
