import type { readAdminSessionOnApi } from "./server";
import type {
  AdminAccess,
  AdminSessionGranted,
  AdminSessionRead,
} from "./state";

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
