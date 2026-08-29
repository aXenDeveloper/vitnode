import { notFound } from "next/navigation";

import type { RawAdminTableParams } from "@/views/admin/table/params";

import { cronAdminModule } from "@/api/modules/admin/advanced/cron/cron.admin.module";
import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { fetcher } from "@/lib/fetcher";
import { normalizeAdminTableParams } from "@/views/admin/table/params";

import { CRON_TABLE_CONTRACT, cronRequest } from "./cron-query";
import { CronTableContent } from "./cron-table-content";
import { mutationApi } from "./run-action/mutation-api.server";

/**
 * The Next.js half of `/admin/core/advanced/cron`: read the page, then hand it
 * to the shared table.
 *
 * Everything Next.js about the screen is in this file. It is a Server Component,
 * so it fetches with `fetcher()` - which reads the admin cookie through
 * `next/headers` - and the run is the server action, unchanged: it ends in
 * `revalidatePath`, which is how a Next.js page refreshes and is the one step
 * that cannot be shared.
 *
 * The request itself is *not* Next.js's. `normalizeAdminTableParams` and
 * `cronRequest` are the same two functions the TanStack Start loader calls, so
 * a URL means the same thing in both apps.
 */
export const CronTableView = async ({
  searchParams,
}: {
  searchParams: Promise<RawAdminTableParams>;
}) => {
  const params = normalizeAdminTableParams(
    await searchParams,
    CRON_TABLE_CONTRACT,
  );
  const res = await fetcher(cronAdminModule, cronRequest(params));

  if (res.status !== 200) {
    return notFound();
  }

  const data = await res.json();

  return (
    <NextDataTableNavigation>
      <CronTableContent data={data} onRun={mutationApi} />
    </NextDataTableNavigation>
  );
};
