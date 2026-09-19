import type { Context } from "hono";

import { beforeAll, describe, expect, it } from "vitest";

import type { ContentNode } from "@/blocks/types";
import type { PageLayoutZones } from "@/database/page-layouts";

import { defineBlock } from "@/blocks/define";
import {
  createBlockRegistry,
  setDefaultBlockRegistry,
} from "@/blocks/registry";
import { defineEditablePage } from "@/content/editor/define";
import { field } from "@/content/fields";

import type { PageLayoutRow } from "./page-layout-service";

import {
  pageLayoutPayload,
  parsePageLayoutZones,
  readPageLayout,
  savePageLayout,
} from "./page-layout-service";

const Noop = () => null;

const heroBlock = defineBlock({
  component: Noop,
  fields: { title: field.text({ maxLength: 40, required: true }) },
  id: "hero",
});

const quoteBlock = defineBlock({
  component: Noop,
  fields: { text: field.text({ maxLength: 80, required: true }) },
  id: "quote",
});

const textBlock = defineBlock({
  component: Noop,
  fields: {
    body: field.text({ maxLength: 80, required: true }),
    width: field.enum({ defaultValue: "prose", values: ["prose", "wide"] }),
  },
  id: "text",
});

beforeAll(() => {
  setDefaultBlockRegistry(
    createBlockRegistry([
      {
        blocks: [heroBlock, quoteBlock, textBlock],
        namespace: "core",
        pluginId: "@vitnode/core",
      },
    ]),
  );
});

const hero = (id: string, title: string): ContentNode => ({
  data: { title },
  id,
  type: "core:hero",
});

const quote = (id: string, text: string): ContentNode => ({
  data: { text },
  id,
  type: "core:quote",
});

const text = (id: string, body: string, width?: string): ContentNode => ({
  data: { body, ...(width === undefined ? {} : { width }) },
  id,
  type: "core:text",
});

const SHIPPED = hero("shipped", "Shipped default");

const page = defineEditablePage({
  id: "example:settings",
  permission: { module: "widgets", permission: "can_edit" },
  zones: {
    "before-profile": {
      allowed: ["core:hero", "core:quote"],
      default: [SHIPPED],
    },
    sidebar: { allowed: ["core:quote"] },
    "after-profile": { allowed: ["core:quote"] },
  },
});

const defaultsPage = defineEditablePage({
  id: "example:defaults",
  permission: { module: "widgets", permission: "can_edit" },
  zones: {
    intro: { allowed: ["core:text"], default: [text("shipped", "Shipped")] },
  },
});

const brokenPage = defineEditablePage({
  id: "example:broken",
  permission: { module: "widgets", permission: "can_edit" },
  zones: {
    intro: {
      allowed: ["core:text"],
      default: [{ data: {}, id: "gone", type: "core:missing" }],
    },
  },
});

const STORED_AT = new Date("2026-01-01T00:00:00Z");

interface Written {
  deletes: number;
  log: string[];
  upserts: PageLayoutZones[];
}

const harness = (zones?: PageLayoutZones, pageId: string = page.id) => {
  let row: null | PageLayoutRow =
    zones === undefined ? null : { pageId, updatedAt: STORED_AT, zones };
  const written: Written = { deletes: 0, log: [], upserts: [] };
  let queue: Promise<unknown> = Promise.resolve();

  const db = {
    delete: () => ({
      where: async () => {
        written.deletes += 1;
        written.log.push("delete");
        row = null;

        return await Promise.resolve([]);
      },
    }),
    execute: async () => {
      written.log.push("lock");

      return await Promise.resolve([]);
    },
    insert: () => ({
      values: (values: { updatedAt: Date; zones: PageLayoutZones }) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            written.log.push("upsert");
            written.upserts.push(values.zones);
            row = {
              pageId,
              updatedAt: values.updatedAt,
              zones: values.zones,
            };

            return await Promise.resolve([row]);
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            written.log.push("select");
            const answered = row;
            await new Promise(resolve => {
              setTimeout(resolve, 0);
            });

            return answered === null ? [] : [answered];
          },
        }),
      }),
    }),
    transaction: async <TResult>(
      body: (tx: typeof db) => Promise<TResult>,
    ): Promise<TResult> => {
      const run = queue.then(async () => {
        written.log.push("begin");

        return await body(db);
      });
      queue = run.then(
        () => undefined,
        () => undefined,
      );

      return await run;
    },
  };

  return {
    c: { get: () => db } as unknown as Context,
    stored: () => row,
    written,
  };
};

const effective = (row: null | PageLayoutRow) =>
  pageLayoutPayload({ page, row, zoneIds: page.zoneIds }).zones;

describe("the effective layout", () => {
  it("is the shipped defaults when no row is stored", async () => {
    const { c } = harness();

    expect(effective(await readPageLayout(c, page.id))).toEqual({
      "after-profile": [],
      "before-profile": [SHIPPED],
      sidebar: [],
    });
  });

  it("overlays one override and leaves the rest on their defaults", async () => {
    const { c } = harness({ sidebar: [quote("s1", "Stored")] });

    expect(effective(await readPageLayout(c, page.id))).toEqual({
      "after-profile": [],
      "before-profile": [SHIPPED],
      sidebar: [quote("s1", "Stored")],
    });
  });

  it("overlays several overrides at once", async () => {
    const { c } = harness({
      "after-profile": [quote("a1", "After")],
      "before-profile": [],
      sidebar: [quote("s1", "Stored")],
    });

    expect(effective(await readPageLayout(c, page.id))).toEqual({
      "after-profile": [quote("a1", "After")],
      "before-profile": [],
      sidebar: [quote("s1", "Stored")],
    });
  });

  it("renders only declared zones, so a retired zone never reaches the page", async () => {
    const { c } = harness({ retired: [quote("r1", "Orphan")] });
    const payload = pageLayoutPayload({
      page,
      row: await readPageLayout(c, page.id),
      zoneIds: page.zoneIds,
    });

    expect(Object.keys(payload.zones)).toEqual(page.zoneIds);
    expect(payload.updatedAt).toBe(STORED_AT.toISOString());
  });

  it("dates itself by the row, and by nothing when there is no row", async () => {
    const { c } = harness();

    expect(
      pageLayoutPayload({
        page,
        row: await readPageLayout(c, page.id),
        zoneIds: page.zoneIds,
      }).updatedAt,
    ).toBe(null);
  });

  it("serves a default with the fields its blocks fill in, like a stored zone", () => {
    expect(
      pageLayoutPayload({
        page: defaultsPage,
        row: null,
        zoneIds: defaultsPage.zoneIds,
      }).zones,
    ).toEqual({ intro: [text("shipped", "Shipped", "prose")] });
  });

  it("refuses a zone whose declared default the zone itself would not accept", () => {
    expect(() =>
      pageLayoutPayload({
        page: brokenPage,
        row: null,
        zoneIds: brokenPage.zoneIds,
      }),
    ).toThrow(/shipped default of the "intro" zone/);
  });
});

describe("a stored row that is not a layout", () => {
  it("is refused rather than answered with the defaults", async () => {
    const { c } = harness({
      sidebar: "not a list",
    } as unknown as PageLayoutZones);

    await expect(readPageLayout(c, page.id)).rejects.toThrow(
      /rather than a list of blocks/,
    );
  });
});

describe("saving", () => {
  it("writes the first override and leaves the other zones alone", async () => {
    const { c, stored, written } = harness();

    const { changed, row } = await savePageLayout(c, {
      expectedZones: { sidebar: [] },
      page,
      zones: { sidebar: [quote("s1", "First")] },
    });

    expect(changed).toEqual(["sidebar"]);
    expect(written.upserts).toEqual([{ sidebar: [quote("s1", "First")] }]);
    expect(effective(row)).toEqual({
      "after-profile": [],
      "before-profile": [SHIPPED],
      sidebar: [quote("s1", "First")],
    });
    expect(stored()?.zones).toEqual({ sidebar: [quote("s1", "First")] });
  });

  it("takes the page's lock and reads inside the same transaction", async () => {
    const { c, written } = harness();

    await savePageLayout(c, {
      expectedZones: { sidebar: [] },
      page,
      zones: { sidebar: [quote("s1", "One")] },
    });

    expect(written.log).toEqual(["begin", "lock", "select", "upsert"]);
  });

  it("keeps the overrides it was not asked about", async () => {
    const { c, written } = harness({
      "before-profile": [quote("b1", "Before")],
      sidebar: [quote("s1", "First")],
    });

    const { changed } = await savePageLayout(c, {
      expectedZones: { sidebar: [quote("s1", "First")] },
      page,
      zones: { sidebar: [quote("s2", "Second")] },
    });

    expect(changed).toEqual(["sidebar"]);
    expect(written.upserts).toEqual([
      {
        "before-profile": [quote("b1", "Before")],
        sidebar: [quote("s2", "Second")],
      },
    ]);
  });

  it("keeps a stored zone the page no longer declares", async () => {
    const { c, written } = harness({ retired: [quote("r1", "Orphan")] });

    await savePageLayout(c, {
      expectedZones: { sidebar: [] },
      page,
      zones: { sidebar: [quote("s1", "New")] },
    });

    expect(written.upserts).toEqual([
      { retired: [quote("r1", "Orphan")], sidebar: [quote("s1", "New")] },
    ]);
    expect(written.deletes).toBe(0);
  });

  it("drops the override when the zone is saved back to its default", async () => {
    const { c, written } = harness({
      "before-profile": [quote("b1", "Custom")],
      sidebar: [quote("s1", "Kept")],
    });

    const { changed, row } = await savePageLayout(c, {
      expectedZones: { "before-profile": [quote("b1", "Custom")] },
      page,
      zones: { "before-profile": [{ ...SHIPPED }] },
    });

    expect(changed).toEqual(["before-profile"]);
    expect(written.upserts).toEqual([{ sidebar: [quote("s1", "Kept")] }]);
    expect(row?.zones).toEqual({ sidebar: [quote("s1", "Kept")] });
  });

  it("stores nothing for a zone first saved at its default", async () => {
    const { c, written } = harness();

    const { changed, row } = await savePageLayout(c, {
      expectedZones: { "before-profile": [{ ...SHIPPED }] },
      page,
      zones: { "before-profile": [{ ...SHIPPED }] },
    });

    expect(changed).toEqual([]);
    expect(written.upserts).toEqual([]);
    expect(written.deletes).toBe(0);
    expect(row).toBe(null);
  });

  it("deletes the row once the last override is back on its default", async () => {
    const { c, stored, written } = harness({
      "before-profile": [quote("b1", "Custom")],
    });

    const { changed, row } = await savePageLayout(c, {
      expectedZones: { "before-profile": [quote("b1", "Custom")] },
      page,
      zones: { "before-profile": [{ ...SHIPPED }] },
    });

    expect(changed).toEqual(["before-profile"]);
    expect(written.deletes).toBe(1);
    expect(written.upserts).toEqual([]);
    expect(row).toBe(null);
    expect(stored()).toBe(null);
    expect(effective(row)["before-profile"]).toEqual([SHIPPED]);
  });

  it("writes nothing when the submitted zones already match what is stored", async () => {
    const { c, written } = harness({ sidebar: [quote("s1", "Same")] });

    const { changed, row } = await savePageLayout(c, {
      expectedZones: { sidebar: [quote("s1", "Same")] },
      page,
      zones: { sidebar: [quote("s1", "Same")] },
    });

    expect(changed).toEqual([]);
    expect(written.upserts).toEqual([]);
    expect(written.deletes).toBe(0);
    expect(row?.updatedAt).toBe(STORED_AT);
  });

  it("refuses a zone the page does not declare before it writes anything", async () => {
    const { c, written } = harness();

    await expect(
      savePageLayout(c, {
        expectedZones: { retired: [] },
        page,
        zones: { retired: [quote("r1", "No")] },
      }),
    ).rejects.toThrow(/has no zone "retired"/);
    expect(written).toEqual({
      deletes: 0,
      log: ["begin", "lock", "select"],
      upserts: [],
    });
  });
});

describe("a zone saved back to a default its blocks fill in", () => {
  const submitted = () =>
    parsePageLayoutZones({
      page: defaultsPage,
      zones: { intro: [text("shipped", "Shipped")] },
    });

  it("is the parsed default, not the declared one", () => {
    expect(submitted()).toEqual({
      intro: [text("shipped", "Shipped", "prose")],
    });
  });

  it("stores no override at all", async () => {
    const { c, written } = harness(undefined, defaultsPage.id);

    const { changed, row } = await savePageLayout(c, {
      expectedZones: submitted(),
      page: defaultsPage,
      zones: submitted(),
    });

    expect(changed).toEqual([]);
    expect(written.upserts).toEqual([]);
    expect(row).toBe(null);
  });

  it("removes the override that was there, and the row with it", async () => {
    const { c, stored, written } = harness(
      { intro: [text("custom", "Custom", "wide")] },
      defaultsPage.id,
    );

    const { changed, row } = await savePageLayout(c, {
      expectedZones: { intro: [text("custom", "Custom", "wide")] },
      page: defaultsPage,
      zones: submitted(),
    });

    expect(changed).toEqual(["intro"]);
    expect(written.deletes).toBe(1);
    expect(written.upserts).toEqual([]);
    expect(row).toBe(null);
    expect(stored()).toBe(null);
  });
});

describe("two moderators saving one page at once", () => {
  it("keeps both of their zones", async () => {
    const { c, stored } = harness();

    await Promise.all([
      savePageLayout(c, {
        expectedZones: { sidebar: [] },
        page,
        zones: { sidebar: [quote("s1", "Sidebar")] },
      }),
      savePageLayout(c, {
        expectedZones: { "after-profile": [] },
        page,
        zones: { "after-profile": [quote("a1", "After")] },
      }),
    ]);

    expect(stored()?.zones).toEqual({
      "after-profile": [quote("a1", "After")],
      sidebar: [quote("s1", "Sidebar")],
    });
  });

  it("keeps a stored zone the page no longer declares", async () => {
    const { c, stored } = harness({ retired: [quote("r1", "Orphan")] });

    await Promise.all([
      savePageLayout(c, {
        expectedZones: { sidebar: [] },
        page,
        zones: { sidebar: [quote("s1", "Sidebar")] },
      }),
      savePageLayout(c, {
        expectedZones: { "after-profile": [] },
        page,
        zones: { "after-profile": [quote("a1", "After")] },
      }),
    ]);

    expect(stored()?.zones).toEqual({
      "after-profile": [quote("a1", "After")],
      retired: [quote("r1", "Orphan")],
      sidebar: [quote("s1", "Sidebar")],
    });
  });

  it("does not let the second save resurrect what the first one removed", async () => {
    const { c, stored } = harness({
      "before-profile": [quote("b1", "Custom")],
      sidebar: [quote("s1", "Stored")],
    });

    await Promise.all([
      savePageLayout(c, {
        expectedZones: { "before-profile": [quote("b1", "Custom")] },
        page,
        zones: { "before-profile": [{ ...SHIPPED }] },
      }),
      savePageLayout(c, {
        expectedZones: { sidebar: [quote("s1", "Stored")] },
        page,
        zones: { sidebar: [quote("s2", "Newer")] },
      }),
    ]);

    expect(stored()?.zones).toEqual({ sidebar: [quote("s2", "Newer")] });
  });

  it("merges two saves that each carry their own zone's baseline", async () => {
    const { c, stored } = harness({
      "after-profile": [quote("a1", "After one")],
      sidebar: [quote("s1", "Sidebar one")],
    });

    const first = await savePageLayout(c, {
      expectedZones: { sidebar: [quote("s1", "Sidebar one")] },
      page,
      zones: { sidebar: [quote("s1", "Sidebar two")] },
    });
    const second = await savePageLayout(c, {
      expectedZones: { "after-profile": [quote("a1", "After one")] },
      page,
      zones: { "after-profile": [quote("a1", "After two")] },
    });

    expect(first.changed).toEqual(["sidebar"]);
    expect(second.changed).toEqual(["after-profile"]);
    expect(stored()?.zones).toEqual({
      "after-profile": [quote("a1", "After two")],
      sidebar: [quote("s1", "Sidebar two")],
    });
  });
});

describe("two moderators saving the same zone", () => {
  it("refuses the one built on a value that has already moved", async () => {
    const { c, stored, written } = harness({ sidebar: [quote("s1", "One")] });

    await savePageLayout(c, {
      expectedZones: { sidebar: [quote("s1", "One")] },
      page,
      zones: { sidebar: [quote("s1", "Two")] },
    });

    await expect(
      savePageLayout(c, {
        expectedZones: { sidebar: [quote("s1", "One")] },
        page,
        zones: { sidebar: [quote("s1", "Three")] },
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(stored()?.zones).toEqual({ sidebar: [quote("s1", "Two")] });
    expect(written.upserts).toEqual([{ sidebar: [quote("s1", "Two")] }]);
  });

  it("says which zone moved, and leaves the rest of the request alone", async () => {
    const { c, stored, written } = harness({
      "after-profile": [quote("a1", "Untouched")],
      sidebar: [quote("s1", "Newer")],
    });

    await expect(
      savePageLayout(c, {
        expectedZones: {
          "after-profile": [quote("a1", "Untouched")],
          sidebar: [quote("s1", "Older")],
        },
        page,
        zones: {
          "after-profile": [quote("a1", "Mine")],
          sidebar: [quote("s1", "Mine")],
        },
      }),
    ).rejects.toThrow(/"sidebar" zone .* moved after this editor read it/);

    expect(written.upserts).toEqual([]);
    expect(stored()?.zones).toEqual({
      "after-profile": [quote("a1", "Untouched")],
      sidebar: [quote("s1", "Newer")],
    });
    expect(stored()?.updatedAt).toBe(STORED_AT);
  });

  it("lets the loser through when it happens to be asking for what is already there", async () => {
    const { c, stored, written } = harness({ sidebar: [quote("s1", "One")] });

    await savePageLayout(c, {
      expectedZones: { sidebar: [quote("s1", "One")] },
      page,
      zones: { sidebar: [quote("s1", "Two")] },
    });

    const { changed } = await savePageLayout(c, {
      expectedZones: { sidebar: [quote("s1", "One")] },
      page,
      zones: { sidebar: [quote("s1", "Two")] },
    });

    expect(changed).toEqual([]);
    expect(written.upserts).toEqual([{ sidebar: [quote("s1", "Two")] }]);
    expect(stored()?.zones).toEqual({ sidebar: [quote("s1", "Two")] });
  });

  it("lets a moderator repair a zone holding a value the editor cannot read", async () => {
    const { c, stored, written } = harness({
      sidebar: ["oops", quote("s1", "One")] as unknown as ContentNode[],
    });

    const { changed } = await savePageLayout(c, {
      expectedZones: { sidebar: [quote("s1", "One")] },
      page,
      zones: { sidebar: [quote("s1", "One")] },
    });

    expect(changed).toEqual(["sidebar"]);
    expect(written.upserts).toEqual([{ sidebar: [quote("s1", "One")] }]);
    expect(stored()?.zones).toEqual({ sidebar: [quote("s1", "One")] });
  });

  it("still guards a zone the editor reads whole but the zone no longer allows", async () => {
    const { c, stored, written } = harness({
      sidebar: [hero("h1", "Not allowed here"), quote("s1", "One")],
    });

    await expect(
      savePageLayout(c, {
        expectedZones: { sidebar: [quote("s1", "One")] },
        page,
        zones: { sidebar: [quote("s1", "Mine")] },
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(written.upserts).toEqual([]);
    expect(stored()?.zones).toEqual({
      sidebar: [hero("h1", "Not allowed here"), quote("s1", "One")],
    });
  });

  it("compares a zone nobody has overridden against its shipped default", async () => {
    const { c, written } = harness();

    const { changed } = await savePageLayout(c, {
      expectedZones: { "before-profile": [{ ...SHIPPED }] },
      page,
      zones: { "before-profile": [quote("b1", "Mine")] },
    });

    expect(changed).toEqual(["before-profile"]);

    await expect(
      savePageLayout(c, {
        expectedZones: { "after-profile": [quote("ghost", "Never stored")] },
        page,
        zones: { "after-profile": [quote("a1", "Mine")] },
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(written.upserts).toEqual([
      { "before-profile": [quote("b1", "Mine")] },
    ]);
  });

  it("refuses a zone it was handed no baseline for", async () => {
    const { c, written } = harness();

    await expect(
      savePageLayout(c, {
        expectedZones: {},
        page,
        zones: { sidebar: [quote("s1", "Mine")] },
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(written.upserts).toEqual([]);
  });

  it("reads the stored zone through the zone's own schema, so a default nobody stored is not a conflict", async () => {
    const { c, written } = harness(
      { intro: [text("custom", "Custom")] },
      defaultsPage.id,
    );

    const { changed } = await savePageLayout(c, {
      expectedZones: { intro: [text("custom", "Custom", "prose")] },
      page: defaultsPage,
      zones: { intro: [text("custom", "Rewritten", "prose")] },
    });

    expect(changed).toEqual(["intro"]);
    expect(written.upserts).toEqual([
      { intro: [text("custom", "Rewritten", "prose")] },
    ]);
  });
});
