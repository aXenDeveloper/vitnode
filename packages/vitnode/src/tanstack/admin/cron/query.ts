import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type {
  CronPageFetcher,
  CronParams,
} from "@/views/admin/views/core/advanced/cron/cron-query";
import type {
  RunCron,
  RunCronResult,
} from "@/views/admin/views/core/advanced/cron/run-action/run-cron";

import {
  cronQueryOptions,
  cronQueryRoot,
  fetchCronPageInBrowser,
} from "@/views/admin/views/core/advanced/cron/cron-query";
import { runCronInBrowser } from "@/views/admin/views/core/advanced/cron/run-action/run-cron";

import { fetchCronPageOnServer } from "./server";

const fetchCronPage: CronPageFetcher = createIsomorphicFn()
  .server(fetchCronPageOnServer)
  .client(fetchCronPageInBrowser);

export const cronQuery = ({ params }: { params: CronParams }) =>
  cronQueryOptions({ fetchPage: fetchCronPage, params });

export const invalidateCron = async (queryClient: QueryClient): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: cronQueryRoot });

export const runCron = async (
  queryClient: QueryClient,
  id: number,
): Promise<RunCronResult> => {
  const result = await runCronInBrowser(id);

  if (!result?.error) await invalidateCron(queryClient);

  return result;
};

export const useCronRunCallback = (): RunCron => {
  const queryClient = useQueryClient();

  return React.useMemo<RunCron>(
    () => async (id: number) => await runCron(queryClient, id),
    [queryClient],
  );
};
