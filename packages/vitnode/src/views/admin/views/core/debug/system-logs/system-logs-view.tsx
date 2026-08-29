import type { RawAdminTableParams } from "@/views/admin/table/params";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { fetcher } from "@/lib/fetcher";
import { Link } from "@/lib/navigation";
import { normalizeAdminTableParams } from "@/views/admin/table/params";

import { DEBUG_LOGS_TABLE_CONTRACT, debugLogsRequest } from "../debug-query";
import { SystemLogsContent } from "./system-logs-content";

/**
 * The Next.js half of the system log: read the page, then hand it to the shared
 * table.
 *
 * A Server Component, so `fetcher()` reads the admin cookie through
 * `next/headers`. The request is not Next.js's: `normalizeAdminTableParams` and
 * `debugLogsRequest` are the same two functions the TanStack Start loader calls.
 */
export const SystemLogsView = async ({
  searchParams,
}: {
  searchParams: Promise<RawAdminTableParams>;
}) => {
  const params = normalizeAdminTableParams(
    await searchParams,
    DEBUG_LOGS_TABLE_CONTRACT,
  );
  const res = await fetcher(debugAdminModule, debugLogsRequest(params));
  const data = await res.json();

  return (
    <NextDataTableNavigation>
      <SystemLogsContent data={data} LinkComponent={Link} />
    </NextDataTableNavigation>
  );
};
