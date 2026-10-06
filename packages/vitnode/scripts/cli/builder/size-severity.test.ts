// @vitest-environment node
import { describe, expect, it } from "vitest";

import { classifySize, needsWarning } from "./size-severity";

describe("classifySize", () => {
  it.each([
    [82_400, "good"],
    [114_700, "normal"],
    [428_600, "warning"],
    [612_400, "large"],
  ] as const)("a %d byte client chunk is %s", (bytes, severity) => {
    expect(classifySize("client-js", bytes)).toBe(severity);
  });

  it("holds stylesheets to a tighter budget than scripts", () => {
    expect(classifySize("css", 120_000)).toBe("warning");
    expect(classifySize("client-js", 120_000)).toBe("normal");
  });

  it("does not judge a server bundle by client thresholds", () => {
    expect(classifySize("server", 1_400_000)).toBe("normal");
    expect(classifySize("client-js", 1_400_000)).toBe("large");
  });

  it("treats an empty file as good", () => {
    expect(classifySize("client-js", 0)).toBe("good");
  });
});

describe("needsWarning", () => {
  it("warns about client chunks from the warning severity up", () => {
    expect(needsWarning("client-js", "warning")).toBe(true);
    expect(needsWarning("client-js", "normal")).toBe(false);
  });

  it("only warns about other client files when they are large", () => {
    expect(needsWarning("css", "warning")).toBe(false);
    expect(needsWarning("css", "large")).toBe(true);
  });

  it("never warns about server output", () => {
    expect(needsWarning("server", "large")).toBe(false);
  });
});
