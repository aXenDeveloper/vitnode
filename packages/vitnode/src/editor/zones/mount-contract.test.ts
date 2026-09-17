// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SRC_ROOT } from "@/tests/import-graph";

const read = (...parts: string[]): string =>
  readFileSync(join(SRC_ROOT, ...parts), "utf8");

const interfaceBody = (source: string, name: string): string => {
  const marker = `interface ${name} {`;
  const start = source.indexOf(marker);

  if (start === -1) {
    throw new Error(`No \`interface ${name}\` in the source read.`);
  }

  let depth = 1;
  let at = start + marker.length;

  while (at < source.length && depth > 0) {
    if (source[at] === "{") depth += 1;
    if (source[at] === "}") depth -= 1;
    at += 1;
  }

  return source.slice(start + marker.length, at - 1);
};

const memberNames = (body: string): string[] => {
  const names: string[] = [];
  let depth = 0;
  let line = "";

  for (const char of `${body}\n`) {
    if (char === "\n") {
      const member = depth === 0 ? /^\s*(\w+)\??\s*[,:]/.exec(line) : null;
      if (member) names.push(member[1]);
      line = "";
      continue;
    }

    if (char === "{" || char === "(" || char === "[") depth += 1;
    if (char === "}" || char === ")" || char === "]") depth -= 1;
    line += char;
  }

  return names.sort();
};

const callArguments = (source: string, call: RegExp): string[] => {
  const found = call.exec(source);

  if (!found) throw new Error(`No call matching ${call.source} in the source.`);

  return memberNames(found[1]);
};

const zoneSource = read("blocks", "zone.tsx");
const mountSource = read("blocks", "edit-context.ts");
const rendererSource = read("blocks", "renderer.tsx");
const editableZoneSource = read("editor", "zones", "editable-zone.tsx");
const rootSource = read("editor", "root.tsx");
const sidebarSource = read("editor", "sidebar", "sidebar.tsx");

const zoneProps = memberNames(interfaceBody(zoneSource, "ContentZoneProps"));
const mountBody = interfaceBody(mountSource, "ContentZoneMount");
const rendererProps = memberNames(
  interfaceBody(rendererSource, "ContentRendererProps"),
);

describe("what edit mode is handed when it takes a content zone over", () => {
  it("found both prop lists to compare", () => {
    expect(zoneProps).toContain("fallback");
    expect(zoneProps).toContain("validate");
    expect(zoneProps.length).toBeGreaterThan(5);
  });

  it("carries every prop the public zone renders with, so nothing is dropped", () => {
    expect(memberNames(mountBody)).toStrictEqual(zoneProps);
  });

  it("declares them required, so omitting one at the call site is a type error", () => {
    expect(mountBody).not.toMatch(/\w\s*\?\s*:/);
  });

  it("hands every one of them to the edit runtime", () => {
    expect(
      callArguments(zoneSource, /renderZone\(\{([\s\S]*?)\}\)/),
    ).toStrictEqual(zoneProps);
  });
});

describe("preview, which has to look like the page really does", () => {
  it("found the renderer's prop list to compare", () => {
    expect(rendererProps).toContain("fallback");
    expect(rendererProps).toContain("validate");
  });

  it("gives the renderer every knob the public zone gives it", () => {
    expect(
      callArguments(
        editableZoneSource,
        /createElement\(ContentRenderer,\s*\{([\s\S]*?)\}\)/,
      ),
    ).toStrictEqual(rendererProps);
  });

  it("takes each of them off the mount rather than inventing a value", () => {
    expect(editableZoneSource).toContain("fallback: mount.fallback");
    expect(editableZoneSource).toContain("validate: mount.validate");
  });
});

describe("persisted values the editor cannot read", () => {
  it("classifies what it was mounted with rather than filtering it away", () => {
    expect(editableZoneSource).toContain("classifyZoneEntries(mount.blocks)");
    expect(editableZoneSource).not.toContain("filter(isBlockInstance)");
  });

  it("offers them back as an explicit removal instead of dropping them", () => {
    expect(editableZoneSource).toContain("<InvalidZoneEntries");
  });

  it("refuses to run the adapter while a zone still holds one", () => {
    expect(rootSource).toContain("unsafeZoneIds(state)");
    expect(rootSource).toMatch(
      /if \(unsafe\.length > 0\) \{[\s\S]*?return false;\n {4}\}/,
    );
  });

  it("makes that refusal the gate the save input is built behind", () => {
    expect(rootSource.indexOf("unsafe.length > 0")).toBeLessThan(
      rootSource.indexOf("buildSaveInput(state)"),
    );
  });
});

describe("the room the editor leaves the page it is editing", () => {
  it("reserves the bottom sheet on small screens and the sidebar on wide ones", () => {
    expect(rootSource).toContain(
      "pb-(--editor-sheet-height) md:pe-(--editor-sidebar-width) md:pb-0",
    );
  });

  it("reserves neither in preview, which is the page as visitors see it", () => {
    expect(rootSource).toMatch(/!preview &&\s*"pb-\(--editor-sheet-height\)/);
  });

  it("caps the sheet at exactly the height the page made room for", () => {
    expect(sidebarSource).toContain("max-h-(--editor-sheet-height)");
    expect(sidebarSource).toContain("md:max-h-none");
  });

  it("declares both measurements in one place", () => {
    expect(rootSource).toContain('"--editor-sheet-height"');
    expect(rootSource).toContain('"--editor-sidebar-width"');
  });
});
