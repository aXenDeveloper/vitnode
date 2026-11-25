import type { MiddlewareHandler } from "hono";

import type { TermsAcceptanceRequiredError } from "../lib/legal/contract";

import { LEGAL_ERROR_CODES } from "../lib/legal/contract";
import { pendingTermsForRequest } from "../lib/legal/state.server";
import { isAdminApiPath } from "../lib/route-metadata";

/**
 * How a route treats a signed-in member who owes Terms acceptance. Set it with
 * `buildRoute({ termsAcceptance })`.
 *
 * - `"writes"` (the default): `POST`, `PUT`, `PATCH` and `DELETE` are blocked;
 *   reads pass, so public pages keep working.
 * - `"required"`: every method is blocked. Use it for personalised community
 *   reads (a member's inbox, a private feed).
 * - `"exempt"`: never blocked. Only for recovery routes: signing in and out,
 *   the session, accepting the Terms, personal-data export, account deletion
 *   and the credential changes those need.
 */
export type TermsAcceptancePolicy = "exempt" | "required" | "writes";

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Answers `403 { error: "terms_acceptance_required", code:
 * "TERMS_ACCEPTANCE_REQUIRED", version, versionId }` when a signed-in member
 * owes Terms acceptance (see `pendingTermsOf`). Guests, AdminCP routes and
 * installs with no effective Terms pass. A lookup that fails (the legal
 * tables are not migrated yet, the database is unreachable) is logged and
 * passes, like the offline-site guard: the check never takes every route
 * down with it. `buildRoute` adds it to every route
 * unless `termsAcceptance` is `"exempt"` or the route has an
 * `adminStaffPermission`.
 */
const createTermsAcceptanceGuard =
  (policy: Exclude<TermsAcceptancePolicy, "exempt">): MiddlewareHandler =>
  async (c, next) => {
    if (policy === "writes" && SAFE_METHODS.has(c.req.method)) {
      return await next();
    }
    if (!c.get("user") || isAdminApiPath(c.req.path)) return await next();

    const pending = await pendingTermsForRequest(c).catch(
      async (error: unknown) => {
        try {
          await c
            .get("log")
            .warn(
              `[Legal] Terms acceptance check skipped: ${error instanceof Error ? error.message : String(error)}`,
            );
        } catch {
          // Logging is best effort here.
        }

        return null;
      },
    );
    if (!pending) return await next();

    c.header("Cache-Control", "no-store");
    const body: TermsAcceptanceRequiredError = {
      code: LEGAL_ERROR_CODES.acceptanceRequired,
      error: "terms_acceptance_required",
      version: pending.version,
      versionId: pending.id,
    };

    return c.json(body, 403);
  };

/** {@link createTermsAcceptanceGuard} for `"writes"`: the default of every route. */
export const termsAcceptanceWritesGuard = createTermsAcceptanceGuard("writes");

/** {@link createTermsAcceptanceGuard} for `"required"`: every method is blocked. */
export const termsAcceptanceRequiredGuard =
  createTermsAcceptanceGuard("required");

/** The shared guard instance of a policy. */
export const termsAcceptanceGuard = (
  policy: Exclude<TermsAcceptancePolicy, "exempt">,
): MiddlewareHandler =>
  policy === "writes"
    ? termsAcceptanceWritesGuard
    : termsAcceptanceRequiredGuard;
