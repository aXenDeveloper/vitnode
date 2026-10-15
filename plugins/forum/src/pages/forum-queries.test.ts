import { createVitNodeQueryClient } from "@vitnode/core/lib/query-client";
import { describe, expect, it, vi } from "vitest";

import {
  forumStatsQueryOptions,
  invalidateForumComments,
  isSharedResponse,
  threadQueryOptions,
} from "./forum-queries";

describe("isSharedResponse", () => {
  it.each<[null | string, boolean]>([
    [null, true],
    ["public, max-age=60", true],
    ["private, no-store", false],
    ["no-store", false],
    ["Private", false],
  ])("Cache-Control %s is shared: %s", (cacheControl, shared) => {
    const headers = new Headers();
    if (cacheControl !== null) headers.set("Cache-Control", cacheControl);

    expect(isSharedResponse(new Response(null, { headers }))).toBe(shared);
  });
});

describe("invalidateForumComments", () => {
  it("makes the next visit refetch the thread and the counts, not another topic's thread", async () => {
    const queryClient = createVitNodeQueryClient();
    const thread = vi.fn(async () => await Promise.resolve(null));
    const otherThread = vi.fn(async () => await Promise.resolve(null));
    const stats = vi.fn(async () => await Promise.resolve([]));
    const load = async () => {
      await queryClient.query({ ...threadQueryOptions(7), queryFn: thread });
      await queryClient.query({
        ...threadQueryOptions(8),
        queryFn: otherThread,
      });
      await queryClient.query({ ...forumStatsQueryOptions(), queryFn: stats });
    };

    await load();
    await load();
    await invalidateForumComments(queryClient, 7);
    await load();

    expect(thread).toHaveBeenCalledTimes(2);
    expect(stats).toHaveBeenCalledTimes(2);
    expect(otherThread).toHaveBeenCalledTimes(1);
  });
});
