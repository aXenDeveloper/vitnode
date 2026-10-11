import { queryOptions } from "@tanstack/react-query";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { CONFIG_PLUGIN } from "@/const";

export const EXAMPLE_OFFERS = {
  lifetime: "lifetime-pass",
  plan: "pro-plan",
} as const;

export type ExampleOfferId =
  (typeof EXAMPLE_OFFERS)[keyof typeof EXAMPLE_OFFERS];

const root = (userId: null | number) =>
  ["@vitnode/example", "payments", userId] as const;

export const exampleAccessQueryOptions = ({
  userId,
}: {
  userId: null | number;
}) =>
  queryOptions({
    queryFn: async () => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "payments",
        path: "/access",
      });

      if (!response.ok) {
        throw new Error(`The example access API answered ${response.status}.`);
      }

      return await response.json();
    },
    queryKey: [...root(userId), "access"] as const,
    retry: false,
    staleTime: 15_000,
  });

/**
 * The protected feature itself. Only requested once access says it is active,
 * and the server checks again - hiding it in the page would protect nothing.
 */
export const exampleFeatureQueryOptions = ({
  offerId,
  userId,
}: {
  offerId: ExampleOfferId;
  userId: null | number;
}) =>
  queryOptions({
    queryFn: async () => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { offerId } },
        method: "get",
        module: "payments",
        path: "/features/{offerId}",
      });

      if (!response.ok) {
        throw new Error(`The example feature API answered ${response.status}.`);
      }

      return await response.json();
    },
    queryKey: [...root(userId), "feature", offerId] as const,
    retry: false,
    staleTime: 60_000,
  });

export const exampleAccessRoot = root;
