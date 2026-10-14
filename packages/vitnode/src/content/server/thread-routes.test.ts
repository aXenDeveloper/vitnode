import { describe, expect, it } from "vitest";

import {
  BOARD,
  createPolicyWorld,
  POLICY_LIVE,
  policyReplyRow,
  policyTopicRow,
} from "@/tests/content-policies";

import type { ContentThreadPage } from "./thread";

const TOPIC = { DRAFT: 12, HIDDEN: 13, LIVE: 10 } as const;

const draft = { publishedAt: null, status: "draft" };

/**
 * Topic 10, oldest first:
 *
 *   100 ─ 101 ─ 102
 *   103 (draft) ─ 104
 *   105 (hidden, no answers)
 *   106 ─ 107 (draft)
 */
const { send } = await createPolicyWorld({
  replies: [
    policyReplyRow(100, TOPIC.LIVE),
    policyReplyRow(101, TOPIC.LIVE, { parent: 100 }),
    policyReplyRow(102, TOPIC.LIVE, { parent: 101 }),
    policyReplyRow(103, TOPIC.LIVE, draft),
    policyReplyRow(104, TOPIC.LIVE, { parent: 103 }),
    policyReplyRow(105, TOPIC.LIVE, { hiddenAt: POLICY_LIVE }),
    policyReplyRow(106, TOPIC.LIVE),
    policyReplyRow(107, TOPIC.LIVE, { parent: 106, ...draft }),
  ],
  topics: [
    policyTopicRow(TOPIC.LIVE, BOARD.OPEN),
    policyTopicRow(TOPIC.DRAFT, BOARD.OPEN, draft),
    policyTopicRow(TOPIC.HIDDEN, BOARD.OPEN, { hiddenAt: POLICY_LIVE }),
  ],
});

type Page = ContentThreadPage<{ body: string; id: number }>;

const read = async (query: string): Promise<Page> => {
  const response = await send("GET", `/replies/thread?${query}`);
  expect(response.status).toBe(200);

  return (await response.json()) as Page;
};

const shape = (page: Page) =>
  page.items.map(({ depth, id, parentId, removed }) => ({
    depth,
    id,
    parentId,
    removed,
  }));

describe("GET /replies/thread", () => {
  it.each([
    ["a draft", String(TOPIC.DRAFT)],
    ["a hidden", String(TOPIC.HIDDEN)],
    ["a missing", "999"],
    ["a malformed", "abc"],
  ])("answers 404 for %s root", async (_label, root) => {
    expect((await send("GET", `/replies/thread?root=${root}`)).status).toBe(
      404,
    );
  });

  it("flattens the thread depth first and keeps a removed reply that has public answers", async () => {
    const page = await read(`root=${TOPIC.LIVE}`);

    expect(shape(page)).toEqual([
      { depth: 1, id: 100, parentId: null, removed: false },
      { depth: 2, id: 101, parentId: 100, removed: false },
      { depth: 3, id: 102, parentId: 101, removed: false },
      { depth: 1, id: 103, parentId: null, removed: true },
      { depth: 2, id: 104, parentId: 103, removed: false },
      { depth: 1, id: 106, parentId: null, removed: false },
    ]);
    expect(page.items.find(item => item.id === 103)?.record).toBeNull();
    expect(page.items.find(item => item.id === 104)?.record).toMatchObject({
      body: "Reply 104",
    });
  });

  it("counts public replies only", async () => {
    const page = await read(`root=${TOPIC.LIVE}`);

    expect(page.replyCount).toBe(5);
    expect(page.pageInfo.totalCount).toBe(2);
  });

  it("pages top-level replies with the after cursor", async () => {
    const first = await read(`root=${TOPIC.LIVE}&first=2`);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(shape(first).map(item => item.id)).toEqual([
      100, 101, 102, 103, 104,
    ]);

    const second = await read(
      `root=${TOPIC.LIVE}&first=2&after=${first.pageInfo.endCursor}`,
    );

    expect(second.pageInfo.hasNextPage).toBe(false);
    expect(shape(second)).toEqual([
      { depth: 1, id: 106, parentId: null, removed: false },
    ]);
  });
});
