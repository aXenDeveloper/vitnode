import { notFound } from "next/navigation";

import type { RawAdminTableParams } from "@/views/admin/table/params";

import { queueAdminModule } from "@/api/modules/admin/advanced/queue/queue.admin.module";
import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { fetcher } from "@/lib/fetcher";
import { normalizeAdminTableParams } from "@/views/admin/table/params";

import { QUEUE_TABLE_CONTRACT, queueRequest } from "./queue-query";
import { QueueTableContent } from "./queue-table-content";

/**
 * The Next.js half of `/admin/core/advanced/queue`: read the page, then hand it
 * to the shared table.
 *
 * A Server Component, so it fetches with `fetcher()` - which reads the admin
 * cookie through `next/headers`. The request itself is not Next.js's:
 * `normalizeAdminTableParams` and `queueRequest` are the same two functions the
 * TanStack Start loader calls.
 */
export const QueueTableView = async ({
  searchParams,
}: {
  searchParams: Promise<RawAdminTableParams>;
}) => {
  const params = normalizeAdminTableParams(
    await searchParams,
    QUEUE_TABLE_CONTRACT,
  );
  const res = await fetcher(queueAdminModule, queueRequest(params));

  if (res.status !== 200) {
    return notFound();
  }

  const data = await res.json();

  return (
    <NextDataTableNavigation>
      <QueueTableContent data={data} />
    </NextDataTableNavigation>
  );
};
