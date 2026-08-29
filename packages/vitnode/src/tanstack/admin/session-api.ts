import type { readAdminSessionOnApi } from "./server";
import type {
  AdminAccess,
  AdminSessionGranted,
  AdminSessionRead,
} from "./state";

/**
 * The admin session's shape, read off the server-side read rather than written
 * out again.
 *
 * The response is a Zod schema in
 * `api/modules/admin/routes/session.route.ts` - `{ user, permissions,
 * vitnode_version }` - and it reaches here through the fetcher's inference, so a
 * field added or renamed there arrives without anybody editing this file. A
 * hand-maintained copy is a second source of truth that typechecks perfectly
 * while disagreeing with the server.
 *
 * The import is type-only, which is what makes the indirection safe: TypeScript
 * erases it, so a browser bundle that reads {@link AdminSessionApi} does not
 * reach `./server`, its `server-only` marker, or the request scope behind it.
 */
export type AdminSessionApi = Extract<
  Awaited<ReturnType<typeof readAdminSessionOnApi>>,
  AdminSessionGranted<unknown>
>["session"];

/** The two decisions the admin session endpoint can hand back. */
export type AdminAccessState = AdminAccess<AdminSessionApi>;

/** Everything a read can produce: a decision, or a failure to reach one. */
export type AdminSessionReadResult = AdminSessionRead<AdminSessionApi>;

/** The administrator the session names. */
export type AdminUser = AdminSessionApi["user"];
