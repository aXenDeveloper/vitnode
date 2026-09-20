import { describe, expect, it, vi } from "vitest";

import type { AnyBlockInstance } from "../../blocks/types";
import type { VisualEditorSaveInput } from "../../editor/adapter/types";
import type {
  EditablePageLayoutPayload,
  EditablePageSavePayload,
} from "./types";

import { saveRefusalOf } from "../../editor/adapter/refusal";
import { createContentEditorAdapter } from "./adapter";
import { defineEditablePage } from "./define";

type Transport = (
  payload: EditablePageSavePayload,
) => Promise<EditablePageLayoutPayload>;

const page = defineEditablePage({
  id: "example:settings",
  permission: { module: "widgets", permission: "can_edit" },
  zones: {
    main: { allowed: ["core:text"] },
    sidebar: { allowed: ["core:text"] },
  },
});

const block = (id: string): AnyBlockInstance => ({
  data: { heading: id },
  id,
  type: "core:text",
});

const payload = (
  zones: Record<string, AnyBlockInstance[]>,
): EditablePageLayoutPayload => ({
  pageId: page.id,
  updatedAt: "2026-01-01T00:00:00.000Z",
  zones,
});

const input = (
  changedZoneIds: string[],
  zones: Record<string, AnyBlockInstance[]>,
  expectedZones: Record<string, AnyBlockInstance[]> = Object.fromEntries(
    changedZoneIds.map(zoneId => [zoneId, [block(`${zoneId}-baseline`)]]),
  ),
): VisualEditorSaveInput => ({ changedZoneIds, expectedZones, zones });

describe("createContentEditorAdapter", () => {
  it("sends the page id and only the zones that changed", async () => {
    const save = vi
      .fn<Transport>()
      .mockResolvedValue(payload({ main: [block("a")] }));
    const adapter = createContentEditorAdapter({ page, save });

    await adapter.save(
      input(["main"], { main: [block("a")], sidebar: [block("b")] }),
    );

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toStrictEqual({
      expectedZones: { main: [block("main-baseline")] },
      pageId: "example:settings",
      zones: { main: [block("a")] },
    });
  });

  it("carries the baseline of the zones it sends, and only of those", async () => {
    const save = vi
      .fn<Transport>()
      .mockResolvedValue(payload({ main: [block("a")] }));
    const adapter = createContentEditorAdapter({ page, save });

    await adapter.save(
      input(
        ["main"],
        { main: [block("a")], sidebar: [block("b")] },
        { main: [block("was")], sidebar: [block("untouched")] },
      ),
    );

    expect(save.mock.calls[0][0].expectedZones).toStrictEqual({
      main: [block("was")],
    });
  });

  it("copies the baseline too, so a later edit cannot rewrite it in flight", async () => {
    const save = vi.fn<Transport>().mockResolvedValue(payload({ main: [] }));
    const adapter = createContentEditorAdapter({ page, save });
    const baseline = [block("was")];

    await adapter.save(
      input(["main"], { main: [block("a")] }, { main: baseline }),
    );

    expect(save.mock.calls[0][0].expectedZones.main).not.toBe(baseline);
    expect(save.mock.calls[0][0].expectedZones.main).toStrictEqual(baseline);
  });

  it("leaves out a changed zone the editor sent no baseline for, rather than inventing one", async () => {
    const save = vi.fn<Transport>().mockResolvedValue(payload({}));
    const adapter = createContentEditorAdapter({ page, save });

    expect(
      await adapter.save(
        input(["main"], { main: [block("a")] }, { sidebar: [block("b")] }),
      ),
    ).toStrictEqual({});
    expect(save).not.toHaveBeenCalled();
  });

  it("returns the server's canonical zones so the reducer re-baselines on them", async () => {
    const stored = payload({ main: [block("canonical")] });
    const adapter = createContentEditorAdapter({
      page,
      save: vi.fn<Transport>().mockResolvedValue(stored),
    });

    const result = await adapter.save(input(["main"], { main: [block("a")] }));

    expect(result).toStrictEqual({ zones: stored.zones });
  });

  it("refuses to save a zone the page does not declare, rather than dropping it", async () => {
    const save = vi.fn<Transport>().mockResolvedValue(payload({}));
    const adapter = createContentEditorAdapter({ page, save });

    await expect(
      adapter.save(
        input(["main", "stray"], { main: [block("a")], stray: [block("c")] }),
      ),
    ).rejects.toThrow(/"stray"/);
    expect(save).not.toHaveBeenCalled();
  });

  it("says so in words the editor can put in front of a person", async () => {
    const adapter = createContentEditorAdapter({
      page,
      save: vi.fn<Transport>().mockResolvedValue(payload({})),
    });

    let refused: string | undefined;

    try {
      await adapter.save(input(["stray"], { stray: [block("c")] }));
    } catch (cause) {
      refused = saveRefusalOf(cause);
    }

    expect(refused).toContain('does not declare "stray"');
    expect(refused).toContain('It declares "main", "sidebar"');
    expect(refused).not.toContain("[Content Engine]");
  });

  it("ignores an undeclared zone that nobody touched", async () => {
    const save = vi
      .fn<Transport>()
      .mockResolvedValue(payload({ main: [block("a")] }));
    const adapter = createContentEditorAdapter({ page, save });

    await adapter.save(
      input(["main"], { main: [block("a")], stray: [block("c")] }),
    );

    expect(save.mock.calls[0][0].zones).toStrictEqual({ main: [block("a")] });
  });

  it("makes no request at all when nothing changed", async () => {
    const save = vi.fn<Transport>().mockResolvedValue(payload({}));
    const adapter = createContentEditorAdapter({ page, save });

    expect(await adapter.save(input([], { main: [block("a")] }))).toStrictEqual(
      {},
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects when the transport rejects, so the editor toasts instead of shipping a default", async () => {
    const adapter = createContentEditorAdapter({
      page,
      save: vi.fn<Transport>().mockRejectedValue(new Error("503")),
    });

    await expect(
      adapter.save(input(["main"], { main: [block("a")] })),
    ).rejects.toThrow("503");
  });

  it("copies the nodes it sends, so a later edit cannot mutate a request in flight", async () => {
    const save = vi.fn<Transport>().mockResolvedValue(payload({ main: [] }));
    const adapter = createContentEditorAdapter({ page, save });
    const nodes = [block("a")];

    await adapter.save(input(["main"], { main: nodes }));

    expect(save.mock.calls[0][0].zones.main).not.toBe(nodes);
  });
});
