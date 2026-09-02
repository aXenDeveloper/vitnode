import type { Context, Next } from "hono";

import { HTTPException } from "hono/http-exception";
import { timingSafeEqual } from "node:crypto";

import { CONFIG, INSECURE_CRON_SECRETS } from "@/lib/config";

/**
 * Constant-time comparison of two secrets.
 *
 * `timingSafeEqual` throws on a length mismatch, so the lengths are compared
 * first - and then both branches still run a comparison, because returning
 * early on a length difference is itself a signal about the secret.
 */
const secretsMatch = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) {
    timingSafeEqual(b, b);

    return false;
  }

  return timingSafeEqual(a, b);
};

/**
 * `Bearer <secret>`, or nothing.
 *
 * Matched as a *prefix* rather than stripped with `replace`, which removed the
 * first `"Bearer "` found anywhere in the header - so `"x Bearer y"` parsed as a
 * credential, and a secret that happened to contain the word lost part of
 * itself.
 */
const bearerToken = (header: string | undefined): string | undefined => {
  if (!header) return undefined;
  const match = /^Bearer (.+)$/.exec(header);

  return match?.[1];
};

export const cronAuthMiddleware = () => {
  return async (c: Context, next: Next) => {
    const cronSecret = c.get("core").cronSecret;
    if (!cronSecret) {
      throw new HTTPException(403, { message: "Cron access not configured" });
    }

    // `CONFIG.cronJobSecret` falls back to a published constant so that a fresh
    // checkout runs its cron jobs without configuration. Outside development
    // that fallback is not a weak secret, it is *no* secret: the value is in the
    // repository, so anyone could post to this endpoint and run every registered
    // job. The admin panel flags it, but a warning nobody reads is not a control,
    // so production refuses the request outright.
    if (
      INSECURE_CRON_SECRETS.includes(cronSecret) &&
      !CONFIG.node_development
    ) {
      throw new HTTPException(403, {
        message:
          "Cron access is disabled because CRON_SECRET is still the built-in default. Set CRON_SECRET to a random value.",
      });
    }

    const providedSecret = bearerToken(c.req.header("authorization"));

    if (!providedSecret || !secretsMatch(providedSecret, cronSecret)) {
      throw new HTTPException(403, { message: "Invalid cron authorization" });
    }

    await next();
  };
};
