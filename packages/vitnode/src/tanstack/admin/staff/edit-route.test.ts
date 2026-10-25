import type { QueryClient } from "@tanstack/react-query";

import { describe, expect, it } from "vitest";

import { MAX_NAMESPACES } from "../../i18n/query";
import { loadStaffPermissionLabels } from "./edit-route";

describe("loadStaffPermissionLabels", () => {
  it("keeps one plugin's labels when two chunks each carry part of it", async () => {
    const scopeKey = "newsroom.moderation.category.label";
    const filler = Array.from(
      { length: MAX_NAMESPACES - 1 },
      (_, index) => `filler${index}`,
    );
    const queryClient = {
      query: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
        await Promise.resolve();

        return {
          locale: "en",
          messages: queryKey.includes(scopeKey)
            ? {
                newsroom: { moderation: { category: { label: "Categories" } } },
              }
            : { newsroom: { title: "Newsroom" } },
        };
      },
    } as unknown as QueryClient;

    const labels = await loadStaffPermissionLabels({
      keys: ["newsroom", ...filler, scopeKey],
      locale: "en",
      queryClient,
    });

    expect(labels).toEqual({
      newsroom: {
        moderation: { category: { label: "Categories" } },
        title: "Newsroom",
      },
    });
  });
});
