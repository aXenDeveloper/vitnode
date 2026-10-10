import { describe, expect, it } from "vitest";

import { isSupportedNodeVersion } from "./node-version.js";

describe("isSupportedNodeVersion", () => {
  it.each(["22.18.0", "22.20.1", "24.11.0", "24.15.0", "26.0.0", "27.1.0"])(
    "accepts %s, a release tsdown runs on",
    version => {
      expect(isSupportedNodeVersion(version)).toBe(true);
    },
  );

  it.each([
    "20.19.0",
    "22.0.0",
    "22.12.0",
    "22.17.1",
    "23.11.0",
    "24.10.0",
    "25.2.0",
  ])("refuses %s, a release tsdown does not support", version => {
    expect(isSupportedNodeVersion(version)).toBe(false);
  });

  it("reads a version with the v prefix of process.version", () => {
    expect(isSupportedNodeVersion("v24.11.0")).toBe(true);
  });
});
