import { dehydrate } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  createVitNodeQueryClient,
  LOADER_DATA_QUERY_META,
} from "./query-client";

const dehydratedKeys = (
  queryClient: ReturnType<typeof createVitNodeQueryClient>,
) => dehydrate(queryClient).queries.map(query => query.queryKey);

describe("createVitNodeQueryClient dehydration", () => {
  it("leaves out queries a loader already ships as loaderData", async () => {
    const queryClient = createVitNodeQueryClient();

    await Promise.all([
      queryClient.query({
        meta: LOADER_DATA_QUERY_META,
        queryFn: () => "article",
        queryKey: ["@acme/blog", "post"],
      }),
      queryClient.query({
        queryFn: () => "session",
        queryKey: ["session"],
      }),
    ]);

    expect(dehydratedKeys(queryClient)).toEqual([["session"]]);
  });

  it("lets the app replace the filter", async () => {
    const queryClient = createVitNodeQueryClient({
      defaultOptions: { dehydrate: { shouldDehydrateQuery: () => true } },
    });

    await queryClient.query({
      meta: LOADER_DATA_QUERY_META,
      queryFn: () => "article",
      queryKey: ["@acme/blog", "post"],
    });

    expect(dehydratedKeys(queryClient)).toEqual([["@acme/blog", "post"]]);
  });
});
