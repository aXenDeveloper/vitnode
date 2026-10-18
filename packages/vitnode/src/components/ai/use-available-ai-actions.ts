import { useQuery } from "@tanstack/react-query";

import type { AiAssistScope } from "@/lib/ai/stream-client";

import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";

/**
 * The AI action keys the current user may run, as a TanStack Query result
 * (`data` is a string array; `[]` on an error response). Use it to hide AI
 * buttons nobody can use. `scope` picks the endpoint: `admin` (the default)
 * asks the AdminCP route for staff, `user` the public one. Cached for 5 minutes.
 */
export const useAvailableAiActions = (scope: AiAssistScope = "admin") =>
  useQuery({
    queryFn: async () => {
      const response =
        scope === "admin"
          ? await fetcher({
              plugin: manifest.id,
              method: "get",
              module: "admin/ai",
              path: "/assist/available",
            })
          : await fetcher({
              plugin: manifest.id,
              method: "get",
              module: "ai",
              path: "/available",
            });
      if (!response.ok) return [] as string[];

      return (await response.json()).actions;
    },
    queryKey: ["ai", "available", scope],
    staleTime: 5 * 60_000,
  });
