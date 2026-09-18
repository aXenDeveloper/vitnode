import type { EnvVitNode } from "@vitnode/core/api/middlewares/global.middleware";
import type { Context } from "hono";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExampleZonesFields } from "@/content/zones-layout-fields";

import { DEFAULT_EXAMPLE_ZONES_LAYOUT } from "@/content/zones-layout-fields";
import { zonesLayoutContent } from "@/database/zones-layouts";

import { writeExampleZonesLayout } from "./layout";

const STORED_AT = new Date("2026-09-18T10:00:00.000Z");

const layoutRow = (id: number) => ({
  ...DEFAULT_EXAMPLE_ZONES_LAYOUT,
  id,
  updatedAt: STORED_AT,
});

const EMPTY_FIELDS: ExampleZonesFields = {
  afterProfile: [],
  beforeFooter: [],
  beforeProfile: [],
  sidebar: [],
};

const harness = ({
  create = vi.fn().mockResolvedValue(layoutRow(1)),
  existingId = null,
  update = vi
    .fn()
    .mockResolvedValue({ changedFields: ["beforeProfile"], row: layoutRow(7) }),
}: {
  create?: ReturnType<typeof vi.fn>;
  existingId?: null | number;
  update?: ReturnType<typeof vi.fn>;
} = {}) => {
  const emit = vi.fn().mockResolvedValue({
    delivered: 0,
    eventId: "event-1",
    failures: [],
    status: "delivered",
  });

  const lock = vi.fn().mockResolvedValue(undefined);
  const commit = vi.fn();
  const limit = vi
    .fn()
    .mockResolvedValue(existingId === null ? [] : [{ id: existingId }]);

  const tx = {
    execute: lock,
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
  };

  const db = {
    transaction: async (run: (handle: typeof tx) => Promise<unknown>) => {
      const result = await run(tx);
      commit();

      return result;
    },
  };

  const store: Record<string, unknown> = { db, events: { emit } };

  vi.spyOn(zonesLayoutContent, "service").mockReturnValue({
    create,
    update,
  } as unknown as ReturnType<typeof zonesLayoutContent.service>);

  return {
    c: { get: (key: string) => store[key] } as unknown as Context<EnvVitNode>,
    commit,
    create,
    emit,
    lock,
    update,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writeExampleZonesLayout", () => {
  it("emits created once for the first save, with the new row's id", async () => {
    const { emit, c } = harness();

    await writeExampleZonesLayout(c, EMPTY_FIELDS);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "content.example.zones-layout.created",
      { contentId: 1 },
      { pluginId: "@vitnode/example" },
    );
  });

  it("emits updated once when the save changed a field", async () => {
    const { emit, c } = harness({ existingId: 7 });

    await writeExampleZonesLayout(c, EMPTY_FIELDS);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "content.example.zones-layout.updated",
      { changedFields: ["beforeProfile"], contentId: 7 },
      { pluginId: "@vitnode/example" },
    );
  });

  it("emits nothing when the save changed no field", async () => {
    const { emit, c } = harness({
      existingId: 7,
      update: vi
        .fn()
        .mockResolvedValue({ changedFields: [], row: layoutRow(7) }),
    });

    const layout = await writeExampleZonesLayout(c, EMPTY_FIELDS);

    expect(emit).not.toHaveBeenCalled();
    expect(layout.source).toBe("stored");
  });

  it("emits nothing when the write fails, so no listener sees a rolled back layout", async () => {
    const { emit, c } = harness({
      existingId: 7,
      update: vi
        .fn()
        .mockRejectedValue(new Error("The transaction was rolled back.")),
    });

    await expect(writeExampleZonesLayout(c, EMPTY_FIELDS)).rejects.toThrow(
      "The transaction was rolled back.",
    );

    expect(emit).not.toHaveBeenCalled();
  });

  it("emits nothing when the row vanished mid-save", async () => {
    const { emit, c } = harness({
      existingId: 7,
      update: vi.fn().mockResolvedValue(null),
    });

    await expect(writeExampleZonesLayout(c, EMPTY_FIELDS)).rejects.toThrow(
      /disappeared/,
    );

    expect(emit).not.toHaveBeenCalled();
  });

  it("takes the advisory lock inside the transaction and emits only once it has committed", async () => {
    const { commit, emit, lock, c } = harness({ existingId: 7 });

    await writeExampleZonesLayout(c, EMPTY_FIELDS);

    const [locked] = lock.mock.invocationCallOrder;
    const [committed] = commit.mock.invocationCallOrder;
    const [emitted] = emit.mock.invocationCallOrder;

    expect(locked).toBeLessThan(committed);
    expect(committed).toBeLessThan(emitted);
  });

  it("still answers with the stored layout rather than the fields it was handed", async () => {
    const { c } = harness();

    const layout = await writeExampleZonesLayout(c, EMPTY_FIELDS);

    expect(layout).toEqual({
      fields: DEFAULT_EXAMPLE_ZONES_LAYOUT,
      source: "stored",
      updatedAt: STORED_AT.toISOString(),
    });
  });
});
