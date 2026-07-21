import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimiterMiddleware } from "./rate-limiter.middleware";

interface Env {
  Variables: { ipAddress: string };
}

const buildApp = (ipAddress: string) => {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("ipAddress", ipAddress);

    return next();
  });
  app.use("*", rateLimiterMiddleware({ points: 1, duration: 60 }));
  app.get("/", c => c.json({ ok: true }));

  return app;
};

describe("rateLimiterMiddleware", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests under the limit", async () => {
    const res = await buildApp("under-limit").request("/");

    expect(res.status).toBe(200);
  });

  it("returns a JSON 429 with a Retry-After header when the limit is exceeded", async () => {
    const app = buildApp("over-limit");
    await app.request("/");
    const res = await app.request("/");

    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toContain("application/json");

    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);

    // The regression this guards against: a plain-text body made callers throw
    // `Unexpected token 'T', "Too Many Requests" is not valid JSON`.
    const body = (await res.json()) as { error: string; retryAfter: number };
    expect(body.error).toBe("Too Many Requests");
    expect(typeof body.retryAfter).toBe("number");
  });

  it("disables rate limiting in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const app = buildApp("dev-ip");
    await app.request("/");
    const res = await app.request("/");

    expect(res.status).toBe(200);
  });
});
