import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INSECURE_CRON_SECRETS,
  INSECURE_DEFAULT_CRON_SECRET,
} from "@/lib/config";

import { cronAuthMiddleware } from "./cron-auth.middleware";

interface Env {
  Variables: { core: { cronSecret?: string } };
}

const buildApp = (cronSecret: string | undefined) => {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("core", { cronSecret });

    return next();
  });
  app.use("*", cronAuthMiddleware());
  app.post("/", c => c.text("ran"));

  return app;
};

const post = async (
  cronSecret: string | undefined,
  authorization?: string,
): Promise<Response> =>
  await buildApp(cronSecret).request("/", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });

describe("cronAuthMiddleware", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs the job for the configured secret", async () => {
    const res = await post("s3cret-value", "Bearer s3cret-value");

    expect(res.status).toBe(200);
  });

  it("refuses a wrong secret", async () => {
    const res = await post("s3cret-value", "Bearer wrong");

    expect(res.status).toBe(403);
  });

  it("refuses a missing authorization header", async () => {
    const res = await post("s3cret-value");

    expect(res.status).toBe(403);
  });

  it("refuses when no secret is configured at all", async () => {
    const res = await post(undefined, "Bearer anything");

    expect(res.status).toBe(403);
  });

  describe("the built-in default secret", () => {
    it("is refused in production", async () => {
      // The regression this guards: `CONFIG.cronJobSecret` falls back to a
      // constant published in this repository, so an install that never set
      // `CRON_SECRET` would run every registered cron job for anyone who read
      // the source.
      const res = await post(
        INSECURE_DEFAULT_CRON_SECRET,
        `Bearer ${INSECURE_DEFAULT_CRON_SECRET}`,
      );

      expect(res.status).toBe(403);
      expect(await res.text()).toContain("CRON_SECRET");
    });

    it.each([...INSECURE_CRON_SECRETS])(
      "refuses the published placeholder %s in production",
      async secret => {
        // The `.env.example` the scaffolder ships carries its own placeholder,
        // so recognising only the code fallback left every install that copied
        // that file and never edited the line just as open.
        const res = await post(secret, `Bearer ${secret}`);

        expect(res.status).toBe(403);
      },
    );

    it("still works in development", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const res = await post(
        INSECURE_DEFAULT_CRON_SECRET,
        `Bearer ${INSECURE_DEFAULT_CRON_SECRET}`,
      );

      expect(res.status).toBe(200);
    });
  });

  describe("header parsing", () => {
    it("does not accept `Bearer` appearing mid-header", async () => {
      // `authHeader.replace("Bearer ", "")` used to strip the first occurrence
      // wherever it sat, so this parsed as the secret.
      const res = await post("s3cret-value", "Basic Bearer s3cret-value");

      expect(res.status).toBe(403);
    });

    it("does not mangle a secret containing the scheme name", async () => {
      const secret = "a Bearer b";
      const res = await post(secret, `Bearer ${secret}`);

      expect(res.status).toBe(200);
    });
  });
});
