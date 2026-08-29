import { fetcherClient } from "@/lib/fetcher-client";

import { cronAdminModuleRef } from "../cron-query";

/**
 * Running one cron job by hand, as a contract both frameworks satisfy.
 *
 * The API already accepts an authenticated `POST` from anywhere:
 * `POST /admin/advanced/cron/{id}` declares
 * `adminStaffPermission: { module: "cron", permission: "can_run" }` and
 * re-checks it against the staff tables on every request. So the browser calls
 * it directly - same origin, admin cookie attached by the browser itself - and
 * there is deliberately no server function in between. One would be a `POST`
 * back to the app that then calls Hono: two round trips and a second place to
 * get the semantics wrong, in exchange for nothing, because this mutation needs
 * no server-only secret and sets no cookie.
 *
 * The Next.js app keeps its server action, which is not a contradiction: there
 * the run has to end with `revalidatePath`, and that only exists on a server.
 * What both sides share is the *shape* below, so one button component can be
 * handed either.
 */

/** What a run reports back. `undefined` is the Next.js action's "it worked". */
export type RunCronResult = undefined | { error?: string };

/** The callback the run button is handed instead of a mutation. */
export type RunCron = (id: number) => Promise<RunCronResult>;

/** The run itself, as arguments to whichever fetcher is carrying it. */
export const runCronRequest = (id: number) =>
  ({
    args: { params: { id: String(id) } },
    method: "post" as const,
    module: "cron" as const,
    path: "/{id}" as const,
    prefixPath: "/admin/advanced",
  }) as const;

/**
 * Runs one cron job from the browser.
 *
 * Never rejects. Every way this can fail is something the administrator has to
 * be told in the toast they are standing next to, and `rawApiFetch` throws on a
 * `500` with the server's own error text - which has already been written to the
 * server log, so the caller needs an outcome rather than a stack.
 */
export const runCronInBrowser: RunCron = async id => {
  try {
    const response = await fetcherClient(cronAdminModuleRef, {
      ...runCronRequest(id),
      options: { credentials: "include" },
    });

    if (!response.ok) return { error: "Failed to run cron job" };

    return undefined;
  } catch {
    return { error: "Failed to run cron job" };
  }
};
