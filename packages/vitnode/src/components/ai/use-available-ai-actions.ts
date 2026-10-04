import { useQuery } from "@tanstack/react-query";

import type { AiAssistScope } from "@/lib/ai/stream-client";

import { CONFIG_PLUGIN } from "@/config";
import { fetcher } from "@/tanstack/fetcher";

/**
 * The AI actions the signed-in person may start, as the server decides it -
 * enabled, a model can run them, and their roles grant them. Only decides
 * which buttons to show; every run is authorized again on the server.
 */
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
