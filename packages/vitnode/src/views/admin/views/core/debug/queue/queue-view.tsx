import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { fetcher } from "@/lib/fetcher";

import { debugQueueRequest } from "../debug-query";
import { QueueViewContent } from "./queue-view-content";

/**
 * The Next.js half of the debug panel's queue snapshot: read it, then hand it to
 * the shared view.
 *
 * A Server Component, so `fetcher()` reads the admin cookie through
 * `next/headers`. The request is `debugQueueRequest`'s - the same object the
 * TanStack Start loader sends.
 */
export const QueueView = async () => {
  const res = await fetcher(debugAdminModule, debugQueueRequest);
  const data = await res.json();

  return <QueueViewContent data={data} />;
};
