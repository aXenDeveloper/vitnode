import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import { core_content_containers } from "@/database/content-containers";
import {
  testBoardContainers,
  testThreadContentType,
} from "@/tests/content-fixtures";
import { createMemoryDb } from "@/tests/memory-db";

import type {
  ContentContainerService,
  ContentContainerUsageCheck,
} from "./service";

import { createContentModel } from "../../server/model";
import { ContentContainerError } from "../errors";
import { createContentContainerService } from "./service";

const PLUGIN_ID = "@vitnode/example";
const CREATED = new Date("2026-09-01T10:00:00.000Z");

/**
 * - 1 General
 *   - 3 News
 *     - 5 Releases
 *   - 4 Help
 *   - 6 Bugs
 * - 2 Off topic (holds content)
 *
 * 9 belongs to another collection, and shares no slug with the boards.
 */
const BOARD = {
  BUGS: 6,
  ELSEWHERE: 9,
  GENERAL: 1,
  HELP: 4,
  MISSING: 99,
  NEWS: 3,
  OFF_TOPIC: 2,
  RELEASES: 5,
} as const;

const TREE_ORDER = [
  BOARD.GENERAL,
  BOARD.NEWS,
  BOARD.RELEASES,
  BOARD.HELP,
  BOARD.BUGS,
  BOARD.OFF_TOPIC,
];

const row = (
  id: number,
  name: string,
  parentId: null | number,
  position: number,
  overrides: Record<string, unknown> = {},
) => ({
  createdAt: CREATED,
  definitionId: testBoardContainers.id,
  id,
  metadata: {},
  name,
  parentId,
  pluginId: PLUGIN_ID,
  position,
  slug: name.toLowerCase().replace(/ /g, "-"),
  updatedAt: CREATED,
  ...overrides,
});

const seed = () => [
  row(BOARD.GENERAL, "General", null, 0, {
    metadata: {
      color: "#ffffff",
      description: "Say hi",
      locked: true,
      notes: "Staff only",
    },
  }),
  row(BOARD.OFF_TOPIC, "Off topic", null, 1),
  row(BOARD.NEWS, "News", BOARD.GENERAL, 0),
  row(BOARD.HELP, "Help", BOARD.GENERAL, 1),
  row(BOARD.RELEASES, "Releases", BOARD.NEWS, 0),
  row(BOARD.BUGS, "Bugs", BOARD.GENERAL, 2),
  row(BOARD.ELSEWHERE, "Elsewhere", null, 0, {
    definitionId: "test.sections",
  }),
];

const holdsContent: ContentContainerUsageCheck = async (_tx, ids) =>
  await Promise.resolve(ids.includes(BOARD.OFF_TOPIC));

const harness = ({
  core,
  usage = holdsContent,
}: {
  core?: unknown;
  usage?: ContentContainerUsageCheck | null;
} = {}) => {
  const memory = createMemoryDb([[core_content_containers, seed()]]);
  const emitted: { name: string; payload: unknown }[] = [];
  const variables: Record<string, unknown> = {
    core,
    db: memory.db,
    events: {
      emit: async (name: string, payload: unknown) => {
        emitted.push({ name, payload });

        return await Promise.resolve({ failures: [] });
      },
    },
  };
  const c = { get: (key: string) => variables[key] } as unknown as Context;
  const service = createContentContainerService(c, {
    definition: testBoardContainers,
    pluginId: PLUGIN_ID,
    usage: usage ?? undefined,
  });
  const rows = () => memory.rows(core_content_containers);
  const placement = (id: number) => {
    const found = rows().find(candidate => candidate.id === id);

    return found && { parentId: found.parentId, position: found.position };
  };

  return { emitted, memory, placement, rows, service };
};

const event = (name: string, payload: Record<string, unknown>) => ({
  name,
  payload: {
    definitionId: testBoardContainers.id,
    pluginId: PLUGIN_ID,
    ...payload,
  },
});

describe("create", () => {
  it("adds a root last, with a slug derived from the name", async () => {
    const { emitted, rows, service } = harness();

    const created = await service.create({ name: "Hello World!" });

    expect(created).toMatchObject({
      depth: 1,
      name: "Hello World!",
      parentId: null,
      position: 2,
      slug: "hello-world",
      metadata: { color: null, description: null, locked: false, notes: null },
    });
    expect(rows().find(candidate => candidate.id === created.id)).toMatchObject(
      {
        definitionId: testBoardContainers.id,
        pluginId: PLUGIN_ID,
      },
    );
    expect(emitted).toEqual([
      event("content.container.created", {
        containerId: created.id,
        parentId: null,
      }),
    ]);
  });

  it("adds a child last among its siblings", async () => {
    const { service } = harness();

    await expect(
      service.create({ name: "Ideas", parentId: BOARD.GENERAL }),
    ).resolves.toMatchObject({
      depth: 2,
      parentId: BOARD.GENERAL,
      position: 3,
    });
  });

  it("inserts at a position and shifts the siblings after it", async () => {
    const { placement, service } = harness();

    const created = await service.create({ name: "Welcome", position: 0 });

    expect(created.position).toBe(0);
    expect(
      [BOARD.GENERAL, BOARD.OFF_TOPIC, BOARD.ELSEWHERE].map(placement),
    ).toEqual([
      { parentId: null, position: 1 },
      { parentId: null, position: 2 },
      // Another collection's root is not a sibling.
      { parentId: null, position: 0 },
    ]);
  });

  it.each([
    [
      "suffixes a derived slug the collection already uses",
      { name: "General" },
      "general-2",
    ],
    [
      "ignores a slug another collection uses",
      { name: "Elsewhere" },
      "elsewhere",
    ],
    ["falls back when the name has no letters", { name: "!!!" }, "container"],
    [
      "normalises an explicit slug",
      { name: "Anything", slug: "Café Corner" },
      "cafe-corner",
    ],
  ])("%s", async (_label, input, slug) => {
    const { service } = harness();

    await expect(service.create(input)).resolves.toMatchObject({ slug });
  });

  it("keeps suffixing until the slug is free", async () => {
    const { service } = harness();

    await service.create({ name: "General" });

    await expect(service.create({ name: "General" })).resolves.toMatchObject({
      slug: "general-3",
    });
  });

  it("serializes concurrent creates, so each one plans against the other", async () => {
    const { service } = harness();

    const created = await Promise.all([
      service.create({ name: "Twin" }),
      service.create({ name: "Twin" }),
    ]);

    expect(created.map(({ position, slug }) => ({ position, slug }))).toEqual([
      { position: 2, slug: "twin" },
      { position: 3, slug: "twin-2" },
    ]);
  });
});

describe("update", () => {
  it("merges a metadata patch into the stored values and announces the change", async () => {
    const { emitted, rows, service } = harness();

    const updated = await service.update(BOARD.GENERAL, {
      metadata: { color: "#000000" },
      name: "Lobby",
    });

    expect(updated).toMatchObject({
      metadata: {
        color: "#000000",
        description: "Say hi",
        locked: true,
        notes: "Staff only",
      },
      name: "Lobby",
      // A rename keeps the address.
      slug: "general",
    });
    expect(
      rows().find(candidate => candidate.id === BOARD.GENERAL),
    ).toMatchObject({
      metadata: updated.metadata,
      name: "Lobby",
    });
    expect(emitted).toEqual([
      event("content.container.updated", {
        changedFields: ["name", "color"],
        containerId: BOARD.GENERAL,
        parentId: null,
      }),
    ]);
  });

  it("changes the slug only when one is sent", async () => {
    const { service } = harness();

    await expect(
      service.update(BOARD.HELP, { slug: "Support Desk" }),
    ).resolves.toMatchObject({ name: "Help", slug: "support-desk" });
  });

  it("keeps its own slug without calling it taken", async () => {
    const { emitted, service } = harness();

    await expect(
      service.update(BOARD.HELP, { slug: "help" }),
    ).resolves.toMatchObject({ slug: "help" });
    expect(emitted).toEqual([]);
  });

  it("writes and announces nothing when nothing changed", async () => {
    const { emitted, rows, service } = harness();
    const before = rows();

    await service.update(BOARD.GENERAL, {
      metadata: { color: "#ffffff" },
      name: "General",
    });

    expect(rows()).toEqual(before);
    expect(emitted).toEqual([]);
  });
});

describe("move", () => {
  it("moves a subtree to another parent and closes the gap it left", async () => {
    const { emitted, service } = harness();

    const moved = await service.move(BOARD.NEWS, {
      parentId: BOARD.OFF_TOPIC,
      position: 0,
    });

    expect(moved).toMatchObject({
      depth: 2,
      parentId: BOARD.OFF_TOPIC,
      position: 0,
    });
    expect(
      (await service.list()).map(({ depth, id, position }) => [
        id,
        depth,
        position,
      ]),
    ).toEqual([
      [BOARD.GENERAL, 1, 0],
      [BOARD.HELP, 2, 0],
      [BOARD.BUGS, 2, 1],
      [BOARD.OFF_TOPIC, 1, 1],
      [BOARD.NEWS, 2, 0],
      [BOARD.RELEASES, 3, 0],
    ]);
    expect(emitted).toEqual([
      event("content.container.moved", {
        containerId: BOARD.NEWS,
        fromParentId: BOARD.GENERAL,
        parentId: BOARD.OFF_TOPIC,
        position: 0,
      }),
    ]);
  });

  it("reorders among siblings", async () => {
    const { placement, service } = harness();

    await service.move(BOARD.BUGS, { parentId: BOARD.GENERAL, position: 0 });

    expect([BOARD.BUGS, BOARD.NEWS, BOARD.HELP].map(placement)).toEqual([
      { parentId: BOARD.GENERAL, position: 0 },
      { parentId: BOARD.GENERAL, position: 1 },
      { parentId: BOARD.GENERAL, position: 2 },
    ]);
  });

  it("moves to the root", async () => {
    const { service } = harness();

    await expect(
      service.move(BOARD.HELP, { parentId: null, position: 0 }),
    ).resolves.toMatchObject({ depth: 1, parentId: null, position: 0 });
  });

  it("lets a leaf go as deep as the collection allows", async () => {
    const { service } = harness();

    await expect(
      service.move(BOARD.HELP, { parentId: BOARD.NEWS, position: 1 }),
    ).resolves.toMatchObject({ depth: 3, parentId: BOARD.NEWS });
  });

  it("announces nothing when a container is dropped where it was", async () => {
    const { emitted, rows, service } = harness();
    const before = rows();

    await expect(
      service.move(BOARD.HELP, { parentId: BOARD.GENERAL, position: 1 }),
    ).resolves.toMatchObject({ id: BOARD.HELP, position: 1 });
    expect(rows()).toEqual(before);
    expect(emitted).toEqual([]);
  });
});

describe("delete", () => {
  it("removes a leaf, renumbers its siblings and announces it", async () => {
    const { emitted, placement, rows, service } = harness();

    await service.delete(BOARD.HELP);

    expect(rows().some(candidate => candidate.id === BOARD.HELP)).toBe(false);
    expect([BOARD.NEWS, BOARD.BUGS].map(placement)).toEqual([
      { parentId: BOARD.GENERAL, position: 0 },
      { parentId: BOARD.GENERAL, position: 1 },
    ]);
    expect(emitted).toEqual([
      event("content.container.deleted", {
        containerId: BOARD.HELP,
        parentId: BOARD.GENERAL,
      }),
    ]);
  });
});

describe("refused writes leave the tree exactly as it was", () => {
  type Write = (
    service: ContentContainerService<typeof testBoardContainers>,
  ) => Promise<unknown>;

  it.each<[string, Write, string]>([
    [
      "create with a taken slug",
      async s => await s.create({ name: "Lobby", slug: "general" }),
      "slugTaken",
    ],
    [
      "create with a slug that normalises to nothing",
      async s => await s.create({ name: "Lobby", slug: "!!!" }),
      "slugEmpty",
    ],
    [
      "create with values the definition refuses",
      async s =>
        await s.create({ metadata: { color: "#1234567" }, name: "Lobby" }),
      "invalidMetadata",
    ],
    [
      "create with a value the definition does not declare",
      async s =>
        await s.create({ metadata: { nope: 1 } as never, name: "Lobby" }),
      "invalidMetadata",
    ],
    [
      "create with a blank name",
      async s => await s.create({ name: "  " }),
      "invalidInput",
    ],
    [
      "create under another collection's container",
      async s => await s.create({ name: "Lobby", parentId: BOARD.ELSEWHERE }),
      "parentNotFound",
    ],
    [
      "create under a missing parent",
      async s => await s.create({ name: "Lobby", parentId: BOARD.MISSING }),
      "parentNotFound",
    ],
    [
      "create below the deepest level",
      async s => await s.create({ name: "Lobby", parentId: BOARD.RELEASES }),
      "maxDepth",
    ],
    [
      "create past the end of the siblings",
      async s => await s.create({ name: "Lobby", position: 3 }),
      "invalidPosition",
    ],
    [
      "update to a taken slug",
      async s => await s.update(BOARD.HELP, { slug: "general" }),
      "slugTaken",
    ],
    [
      "update with values the definition refuses",
      async s =>
        await s.update(BOARD.HELP, { metadata: { color: "#1234567" } }),
      "invalidMetadata",
    ],
    [
      "update with nothing in it",
      async s => await s.update(BOARD.HELP, {}),
      "invalidInput",
    ],
    [
      "update another collection's container",
      async s => await s.update(BOARD.ELSEWHERE, { name: "Mine" }),
      "notFound",
    ],
    [
      "move into itself",
      async s =>
        await s.move(BOARD.GENERAL, { parentId: BOARD.GENERAL, position: 0 }),
      "cycle",
    ],
    [
      "move into a descendant",
      async s =>
        await s.move(BOARD.GENERAL, { parentId: BOARD.RELEASES, position: 0 }),
      "cycle",
    ],
    [
      "move a subtree past the deepest level",
      async s =>
        await s.move(BOARD.NEWS, { parentId: BOARD.HELP, position: 0 }),
      "maxDepth",
    ],
    [
      "move under another collection's container",
      async s =>
        await s.move(BOARD.OFF_TOPIC, {
          parentId: BOARD.ELSEWHERE,
          position: 0,
        }),
      "parentNotFound",
    ],
    [
      "move another collection's container",
      async s => await s.move(BOARD.ELSEWHERE, { parentId: null, position: 0 }),
      "notFound",
    ],
    [
      "move past the end of the siblings",
      async s =>
        await s.move(BOARD.HELP, { parentId: BOARD.OFF_TOPIC, position: 1 }),
      "invalidPosition",
    ],
    [
      "delete a container with children",
      async s => await s.delete(BOARD.GENERAL),
      "hasChildren",
    ],
    [
      "delete a container that holds content",
      async s => await s.delete(BOARD.OFF_TOPIC),
      "hasContent",
    ],
    [
      "delete another collection's container",
      async s => await s.delete(BOARD.ELSEWHERE),
      "notFound",
    ],
  ])("refuses to %s", async (_label, write, code) => {
    const { emitted, rows, service } = harness();
    const before = rows();

    const error = await write(service).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ContentContainerError);
    expect(error).toMatchObject({ code });
    expect(rows()).toEqual(before);
    expect(emitted).toEqual([]);
  });
});

describe("reads", () => {
  it("lists one collection in tree order, with depths", async () => {
    const { service } = harness();

    expect((await service.list()).map(({ depth, id }) => [id, depth])).toEqual([
      [BOARD.GENERAL, 1],
      [BOARD.NEWS, 2],
      [BOARD.RELEASES, 3],
      [BOARD.HELP, 2],
      [BOARD.BUGS, 2],
      [BOARD.OFF_TOPIC, 1],
    ]);
    expect((await service.list()).map(({ id }) => id)).toEqual(TREE_ORDER);
  });

  it("never finds another collection's container", async () => {
    const { service } = harness();

    await expect(service.findById(BOARD.ELSEWHERE)).resolves.toBeNull();
    await expect(service.findBySlug("elsewhere")).resolves.toBeNull();
    await expect(service.descendantIds(BOARD.ELSEWHERE)).resolves.toBeNull();
    await expect(service.ancestors(BOARD.ELSEWHERE)).resolves.toEqual([]);
  });

  it("finds a container by id and by slug, with its depth", async () => {
    const { service } = harness();

    await expect(service.findById(BOARD.RELEASES)).resolves.toMatchObject({
      depth: 3,
      slug: "releases",
    });
    await expect(service.findBySlug("releases")).resolves.toMatchObject({
      id: BOARD.RELEASES,
    });
  });

  it("lists the direct children of a container, or the roots", async () => {
    const { service } = harness();

    expect((await service.children(BOARD.GENERAL)).map(({ id }) => id)).toEqual(
      [BOARD.NEWS, BOARD.HELP, BOARD.BUGS],
    );
    expect((await service.children(null)).map(({ id }) => id)).toEqual([
      BOARD.GENERAL,
      BOARD.OFF_TOPIC,
    ]);
  });

  it.each([
    [
      BOARD.GENERAL,
      [BOARD.GENERAL, BOARD.NEWS, BOARD.HELP, BOARD.RELEASES, BOARD.BUGS],
    ],
    [BOARD.NEWS, [BOARD.NEWS, BOARD.RELEASES]],
    [BOARD.RELEASES, [BOARD.RELEASES]],
  ])("gives container %i and everything below it", async (id, expected) => {
    const { service } = harness();

    expect(new Set(await service.descendantIds(id))).toEqual(new Set(expected));
  });

  it("is null for the subtree of a container that does not exist", async () => {
    const { service } = harness();

    await expect(service.descendantIds(BOARD.MISSING)).resolves.toBeNull();
  });

  it.each([
    [BOARD.RELEASES, [BOARD.GENERAL, BOARD.NEWS]],
    [BOARD.HELP, [BOARD.GENERAL]],
    [BOARD.GENERAL, []],
    [BOARD.MISSING, []],
  ])("gives the ancestors of %i, root first", async (id, expected) => {
    const { service } = harness();

    expect((await service.ancestors(id)).map(record => record.id)).toEqual(
      expected,
    );
  });

  it("strips every metadata field the definition does not publish", async () => {
    const { service } = harness();
    const record = await service.findById(BOARD.GENERAL);
    if (!record) throw new Error("Expected the seeded board.");

    expect(service.toPublic(record)).toEqual({
      depth: 1,
      id: BOARD.GENERAL,
      metadata: { color: "#ffffff", description: "Say hi" },
      name: "General",
      parentId: null,
      position: 0,
      slug: "general",
    });
  });
});

describe("contentContainerUsageFrom", () => {
  const threads = createContentModel(testThreadContentType);

  // No `usage` option: the service reads the registered content models off the
  // context, exactly as it does in a running app.
  const harnessWithThread = async (board: number) => {
    const context = harness({
      core: { contentModels: [{ model: threads, pluginId: PLUGIN_ID }] },
      usage: null,
    });
    await context.memory.db.insert(threads.table).values({
      author: 1,
      board,
      slug: "hello",
      title: "Hello",
    });

    return context;
  };

  it("refuses to delete a container a registered content type still points at", async () => {
    const { rows, service } = await harnessWithThread(BOARD.HELP);
    const before = rows();

    await expect(service.delete(BOARD.HELP)).rejects.toMatchObject({
      code: "hasContent",
    });
    expect(rows()).toEqual(before);
  });

  it("deletes a container nothing points at", async () => {
    const { rows, service } = await harnessWithThread(BOARD.BUGS);

    await service.delete(BOARD.HELP);

    expect(rows().some(candidate => candidate.id === BOARD.HELP)).toBe(false);
  });
});
