// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  categorize,
  dedupeKeys,
  isReportedFile,
  logicalKey,
  stripHash,
} from "./output-files";

const root = "/app";

describe("categorize", () => {
  it.each([
    ["assets/index-C8Fb2aaa.js", "client", "client-js"],
    ["assets/index-K1F3aaaa.css", "client", "css"],
    ["assets/logo-Ab12cdEf.png", "client", "asset"],
    ["assets/font-Ab12cdEf.woff2", "client", "asset"],
    ["manifest.webmanifest", "client", "other"],
    ["index.mjs", "server", "server"],
    ["styles.css", "server", "server"],
  ] as const)("%s from the %s is %s", (fileName, consumer, expected) => {
    expect(categorize(fileName, consumer)).toBe(expected);
  });

  it("never reports source maps", () => {
    expect(isReportedFile("assets/index.js.map")).toBe(false);
    expect(isReportedFile("assets/index.js")).toBe(true);
  });
});

describe("stripHash", () => {
  it.each([
    ["assets/index-C8Fb2xQ1.js", "assets/index.js"],
    ["assets/custom-emoji-BPTfd_f5.js", "assets/custom-emoji.js"],
    ["assets/styles-_Fdh3UXR.css", "assets/styles.css"],
    ["assets/editor.F9aK2bQ3.js", "assets/editor.js"],
  ])("strips the content hash from %s", (fileName, expected) => {
    expect(stripHash(fileName)).toBe(expected);
  });

  it("leaves a plain eight-letter word alone", () => {
    expect(stripHash("assets/use-provider.js")).toBe("assets/use-provider.js");
  });
});

describe("logicalKey", () => {
  it("identifies an entry chunk by the module it fronts, whatever its hash", () => {
    const build = (fileName: string) =>
      logicalKey(
        {
          environment: "client",
          facadeModuleId: "/app/src/pages/editor.tsx",
          fileName,
          name: "editor",
          type: "chunk",
        },
        root,
      );

    expect(build("assets/editor-F9aK2bQ3.js")).toBe(
      "client:src/pages/editor.tsx",
    );
    expect(build("assets/editor-H2kq9ZZ1.js")).toBe(
      build("assets/editor-F9aK2bQ3.js"),
    );
  });

  it("identifies a shared chunk by its name and largest module", () => {
    expect(
      logicalKey(
        {
          environment: "client",
          facadeModuleId: null,
          fileName: "assets/index-AAAAAAA1.js",
          modules: [
            { id: "/app/node_modules/react-dom/index.js", renderedLength: 900 },
            { id: "/app/src/a.ts", renderedLength: 10 },
          ],
          name: "index",
          type: "chunk",
        },
        root,
      ),
    ).toBe("client:index@node_modules/react-dom/index.js");
  });

  it("identifies an asset by its source file", () => {
    expect(
      logicalKey(
        {
          environment: "client",
          fileName: "assets/logo-Ab12cdEf.png",
          originalFileNames: ["src/assets/logo.png"],
          type: "asset",
        },
        root,
      ),
    ).toBe("client:src/assets/logo.png");
  });

  it("falls back to the file name without its hash", () => {
    expect(
      logicalKey(
        {
          environment: "client",
          fileName: "assets/x-Ab12cdEf.css",
          type: "asset",
        },
        root,
      ),
    ).toBe("client:assets/x.css");
  });

  it("is machine-independent: Windows paths become forward slashes", () => {
    expect(
      logicalKey(
        {
          environment: "client",
          facadeModuleId: "C:\\app\\src\\main.tsx",
          fileName: "main.js",
          type: "chunk",
        },
        "C:\\app",
      ),
    ).not.toContain("\\");
  });

  it("makes repeated keys unique without merging them", () => {
    expect(
      dedupeKeys([{ key: "a" }, { key: "a" }, { key: "b" }]).map(
        file => file.key,
      ),
    ).toEqual(["a", "a#2", "b"]);
  });
});
