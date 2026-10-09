import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authRateLimiterMiddleware,
  rateLimiterMiddleware,
  rateLimitKey,
} from "./rate-limiter.middleware";

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

describe("rateLimitKey", () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["::ffff:203.0.113.7", "203.0.113.7"],
    ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
    ["2001:0db8:0001:0002:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
  ])("keys %s as %s", (ipAddress, key) => {
    expect(rateLimitKey(ipAddress)).toBe(key);
  });
});

describe("rateLimiterMiddleware keying", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shares one budget across an IPv6 /64", async () => {
    const app = new Hono<Env>();
    app.use("*", async (c, next) => {
      c.set("ipAddress", c.req.header("x-test-ip") ?? "");

      return next();
    });
    app.use("*", rateLimiterMiddleware({ points: 1, duration: 60 }));
    app.get("/", c => c.json({ ok: true }));

    const first = await app.request("/", {
      headers: { "x-test-ip": "2001:db8:aa:bb::1" },
    });
    const rotated = await app.request("/", {
      headers: { "x-test-ip": "2001:db8:aa:bb::2" },
    });
    const otherNetwork = await app.request("/", {
      headers: { "x-test-ip": "2001:db8:aa:cc::1" },
    });

    expect(first.status).toBe(200);
    expect(rotated.status).toBe(429);
    expect(otherNetwork.status).toBe(200);
  });
});

describe("authRateLimiterMiddleware", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const buildAuthApp = (ipAddress: string) => {
    const app = new Hono<Env>().basePath("/api");
    app.use("*", async (c, next) => {
      c.set("ipAddress", ipAddress);

      return next();
    });
    app.use("*", authRateLimiterMiddleware({ points: 2, duration: 60 }));
    app.post("/@vitnode/core/users/sign_in", c => c.json({ ok: true }));
    app.post("/@vitnode/core/users/passkeys/sign-in", c =>
      c.json({ ok: true }),
    );
    app.get("/@vitnode/core/users/session", c => c.json({ ok: true }));

    return app;
  };

  it("limits sign-in attempts with its own budget", async () => {
    const app = buildAuthApp("auth-sign-in");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await app.request("/api/@vitnode/core/users/sign_in", {
        method: "POST",
      });
      statuses.push(res.status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });

  it("counts every credential route against the same budget", async () => {
    const app = buildAuthApp("auth-shared");
    await app.request("/api/@vitnode/core/users/sign_in", { method: "POST" });
    await app.request("/api/@vitnode/core/users/passkeys/sign-in", {
      method: "POST",
    });
    const res = await app.request("/api/@vitnode/core/users/sign_in", {
      method: "POST",
    });

    expect(res.status).toBe(429);
  });

  it("leaves other routes to the global budget", async () => {
    const app = buildAuthApp("auth-other");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await app.request("/api/@vitnode/core/users/session");
      statuses.push(res.status);
    }

    expect(statuses).toEqual([200, 200, 200]);
  });
});
