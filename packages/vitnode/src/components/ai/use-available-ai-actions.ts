import { useQuery } from "@tanstack/react-query";

import type { AiAssistScope } from "@/lib/ai/stream-client";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";

export const useAvailableAiActions = (scope: AiAssistScope = "admin") =>
  useQuery({
    queryFn: async () => {
      const response =
        scope === "admin"
          ? await fetcher({
              plugin: CONFIG_PLUGIN.pluginId,
              method: "get",
              module: "admin/ai",
              path: "/assist/available",
            })
          : await fetcher({
              plugin: CONFIG_PLUGIN.pluginId,
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
