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
const outletSource = read("blocks", "zone-outlet.tsx");
const hostSource = read("blocks", "edit.tsx");
const siteShellSource = read("blocks", "edit-widgets-host.tsx");
const shellSource = read("blocks", "editor-shell.ts");
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

  it("hands every one of them to the outlet the editor portals into", () => {
    expect(
      callArguments(zoneSource, /mount:\s*\{([\s\S]*?)\},\s*\n\s*runtime:/),
    ).toStrictEqual(zoneProps);
  });

  it("gives the outlet the very runtime the zone read from context", () => {
    expect(zoneSource).toContain("runtime: editRuntime");
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

  it("drops the outlet out of the layout when the public zone would wrap nothing", () => {
    expect(outletSource).toContain("runtime.preview");
    expect(outletSource).toContain('display: "contents"');
  });
});

describe("the page subtree, which edit mode must never remount", () => {
  it("renders the children in one fixed slot rather than behind the toggle", () => {
    expect(hostSource).toMatch(
      /<ContentEditContext value=\{runtime\}>\s*\{children\}/,
    );
    expect(hostSource).not.toMatch(/\{enabled[\s\S]{0,400}\{children\}/);
  });

  it("keeps the edit context mounted in both modes, and only swaps its value", () => {
    expect(hostSource).toContain("<ContentEditContext value={runtime}>");
    expect(hostSource).toMatch(
      /enabled \|\| closing\s*\?[\s\S]{0,120}:\s*null/,
    );
  });

  it("loads the editor as a sibling of the page, never as a wrapper around it", () => {
    expect(hostSource).not.toMatch(/<EditorRoot[^>]*>[\s\S]*?\{children\}/);
    expect(hostSource).toContain("<Suspense fallback={null}>");
  });

  it("gives the editor no children prop at all to wrap", () => {
    expect(
      memberNames(interfaceBody(rootSource, "EditorRootProps")),
    ).toStrictEqual([
      "adapter",
      "closing",
      "onExit",
      "outlets",
      "preview",
      "setPreview",
    ]);
  });

  it("puts each zone back in its place with a portal instead", () => {
    expect(rootSource).toContain("createPortal(");
    expect(rootSource).toContain("outlet.node");
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

describe("zones that leave the page while the editor is still open", () => {
  it("unregisters the very node it registered, not whatever holds the id now", () => {
    expect(outletSource).toContain("runtime.releaseZone({ id, node })");
  });

  it("keeps that lifetime separate from syncing the mount's content", () => {
    expect(outletSource).toMatch(
      /return \(\) => \{\s*runtime\.releaseZone\(\{ id, node \}\);\s*\};\s*\},\s*\[id, node, runtime\]\)/,
    );
  });

  it("tells the reducer the zone is gone when the portal unmounts", () => {
    expect(editableZoneSource).toMatch(
      /useEffect\(\s*\(\) => \(\) => \{\s*dispatch\(\{ type: "unmount", zoneId: id \}\);\s*\},\s*\[dispatch, id\],\s*\)/,
    );
  });

  it("clears an insert target left pointing at a zone that has gone", () => {
    expect(rootSource).toContain("!(insertTarget.zoneId in state.zones)");
  });
});

describe("the room the editor leaves the page it is editing", () => {
  it("reserves the bottom sheet on small screens and the sidebar on wide ones", () => {
    expect(shellSource).toContain(
      "pb-(--editor-sheet-height) md:pe-(--editor-sidebar-width) md:pb-0",
    );
  });

  it("reserves neither until the editor says which mode it is in", () => {
    expect(siteShellSource).toMatch(
      /shell === "editing" && EDITOR_SHELL_EDITING_CLASS/,
    );
  });

  it("reserves it from the whole site, never from the page alone", () => {
    expect(hostSource).not.toContain("EDITOR_SHELL_EDITING_CLASS");
    expect(hostSource).not.toContain("setShell");
  });

  it("keeps the box it pads, so the room it gives back is given back smoothly", () => {
    expect(siteShellSource).toContain("style={EDITOR_SHELL_STYLE}");
    expect(siteShellSource).toContain("cn(\n          EDITOR_SHELL_CLASS,");
    expect(siteShellSource).not.toContain('display: "contents"');
    expect(shellSource).not.toContain("IDLE_STYLE");
  });

  it("is the editor itself that asks for the room, not the seam that loads it", () => {
    expect(rootSource).toContain("setShell(shell)");
    expect(rootSource).toMatch(
      /shell: ContentEditorShellMode \| null = closing\s*\?\s*null/,
    );
  });

  it("caps the sheet at exactly the height the page made room for", () => {
    expect(sidebarSource).toContain("max-h-(--editor-sheet-height)");
    expect(sidebarSource).toContain("md:max-h-none");
  });

  it("declares both measurements in one place the sidebar reads too", () => {
    expect(shellSource).toContain('"--editor-sheet-height"');
    expect(shellSource).toContain('"--editor-sidebar-width"');
    expect(sidebarSource).toContain("EDITOR_SHELL_STYLE");
  });
});
