import { Hono } from "hono";
import { cors } from "hono/cors";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CacheClient } from "@/api/lib/cache";

import { clientIpMiddleware } from "@/api/lib/client-ip";

import {
  RATE_LIMITER_DEFAULTS,
  RATE_LIMITER_KEY_PREFIXES,
  type RateLimiterConfig,
  resolveRateLimiterConfig,
} from "./rate-limiter-config";
import {
  createRateLimiter,
  rateLimiterCategoriesFor,
  rateLimiterMiddleware,
  rateLimitKey,
  rateLimitPathTemplate,
} from "./rate-limiter.middleware";

interface Env {
  Variables: { ipAddress: string };
}

const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

// Budgets big enough to stay out of the way of the one a test exhausts.
const ROOMY = { points: 100, duration: 60 };

const buildApp = (
  config: RateLimiterConfig,
  {
    ipAddress = "203.0.113.7",
    storeClient,
  }: { ipAddress?: string; storeClient?: CacheClient } = {},
) => {
  const app = new Hono<Env>().basePath("/api");
  const limiter = rateLimiterMiddleware(config, storeClient);

  app.use("*", async (c, next) => {
    c.set("ipAddress", c.req.header("x-test-ip") ?? ipAddress);

    return next();
  });
  app.use("*", limiter.preflight);
  app.use("*", cors({ origin: "https://web.example" }));
  app.use("*", limiter.requests);
  app.all("*", c => c.json({ ok: true }));

  return app;
};

const statusesOf = async (
  app: ReturnType<typeof buildApp>,
  requests: [method: string, path: string][],
) => {
  const statuses: number[] = [];
  for (const [method, path] of requests) {
    statuses.push((await app.request(path, { method })).status);
  }

  return statuses;
};

const times = <T>(count: number, value: T): T[] =>
  Array.from({ length: count }, () => value);

const silenceWarnings = () =>
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  silenceWarnings();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("rateLimiterMiddleware", () => {
  it("spends one read point per GET, and only on reads", async () => {
    const app = buildApp({ safety: ROOMY, read: { points: 2 }, write: ROOMY });

    await expect(
      statusesOf(app, [
        ["GET", "/api/topics"],
        ["HEAD", "/api/topics"],
        ["GET", "/api/topics"],
        ["POST", "/api/topics"],
      ]),
    ).resolves.toEqual([200, 200, 429, 200]);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "PROPFIND"])(
    "counts %s against the write budget",
    async method => {
      const app = buildApp({
        safety: ROOMY,
        read: ROOMY,
        write: { points: 1 },
      });

      await expect(
        statusesOf(app, [
          [method, "/api/topics/7"],
          ["POST", "/api/topics"],
          ["GET", "/api/topics"],
        ]),
      ).resolves.toEqual([200, 429, 200]);
    },
  );

  it("caps every method with the safety budget", async () => {
    const app = buildApp({ safety: { points: 3 }, read: ROOMY, write: ROOMY });
    await statusesOf(app, times(3, ["GET", "/api/topics"]));

    const res = await app.request("/api/topics", { method: "POST" });

    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Category")).toBe("safety");
  });

  it("returns a JSON 429 with Retry-After and the refusing category", async () => {
    const app = buildApp({ read: { points: 1 } });
    await app.request("/api/topics");
    const res = await app.request("/api/topics");

    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("X-RateLimit-Category")).toBe("read");

    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);

    // The regression this guards against: a plain-text body made callers throw
    // `Unexpected token 'T', "Too Many Requests" is not valid JSON`.
    await expect(res.json()).resolves.toEqual({
      error: "Too Many Requests",
      retryAfter,
    });
  });

  it("counts a CORS preflight once, against safety only", async () => {
    const app = buildApp({ safety: { points: 2 }, read: ROOMY, write: ROOMY });
    const preflight = {
      method: "OPTIONS",
      headers: {
        origin: "https://web.example",
        "access-control-request-method": "POST",
      },
    };

    const first = await app.request("/api/topics", preflight);
    const second = await app.request("/api/topics", preflight);
    const third = await app.request("/api/topics", preflight);

    expect([first.status, second.status, third.status]).toEqual([
      204, 204, 429,
    ]);
    expect(third.headers.get("X-RateLimit-Category")).toBe("safety");
  });

  it("keeps different visitors on separate budgets", async () => {
    const app = buildApp({ read: { points: 1 } });
    const as = async (ip: string) =>
      app.request("/api/topics", { headers: { "x-test-ip": ip } });

    await as("198.51.100.1");

    expect((await as("198.51.100.1")).status).toBe(429);
    expect((await as("198.51.100.2")).status).toBe(200);
  });

  it("shares one budget across an IPv6 /64", async () => {
    const app = buildApp({ read: { points: 1 } });
    const as = async (ip: string) =>
      app.request("/api/topics", { headers: { "x-test-ip": ip } });

    expect((await as("2001:db8:aa:bb::1")).status).toBe(200);
    expect((await as("2001:db8:aa:bb::2")).status).toBe(429);
    expect((await as("2001:db8:aa:cc::1")).status).toBe(200);
  });

  it("disables rate limiting in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const app = buildApp({ safety: { points: 1 } });

    await expect(
      statusesOf(app, times(3, ["GET", "/api/topics"])),
    ).resolves.toEqual([200, 200, 200]);
  });

  it("logs the first refusal in a window with a route template and no visitor details", async () => {
    const warn = silenceWarnings();
    const app = new Hono<Env>().basePath("/api");
    const limiter = rateLimiterMiddleware({ write: { points: 1 } });
    app.use("*", async (c, next) => {
      c.set("ipAddress", "198.51.100.77");

      return next();
    });
    app.use("*", limiter.requests);
    app.patch("/@acme/forum/topics/:id", c => c.json({ ok: true }));

    await statusesOf(
      app,
      times(4, ["PATCH", "/api/@acme/forum/topics/8f14e45f?token=secret"]),
    );

    expect(warn).toHaveBeenCalledOnce();
    const [line] = warn.mock.calls[0] as [string];
    expect(line).toContain(
      JSON.stringify({
        category: "write",
        method: "PATCH",
        path: "/api/@acme/forum/topics/:id",
        status: 429,
        retryAfter: 60,
        store: "memory",
      }),
    );
    expect(line).not.toContain("198.51.100");
    expect(line).not.toContain("secret");
  });
});

describe("rateLimiterMiddleware for sign-in", () => {
  it("counts every credential route against one strict budget", async () => {
    const app = buildApp({ auth: { points: 2 } });

    await expect(
      statusesOf(app, [
        ["POST", "/api/@vitnode/core/users/sign_in"],
        ["POST", "/api/@vitnode/core/users/passkeys/sign-in"],
        ["POST", "/api/@vitnode/core/users/sign_in"],
        ["GET", "/api/@vitnode/core/users/session"],
        ["POST", "/api/@vitnode/core/users/sign_out"],
      ]),
    ).resolves.toEqual([200, 200, 429, 200, 200]);
  });

  it("spends safety and write on a sign-in too", async () => {
    const app = buildApp({ write: { points: 2 }, auth: ROOMY });

    await expect(
      statusesOf(app, [
        ["POST", "/api/@vitnode/core/users/sign_in"],
        ["DELETE", "/api/topics/7"],
        ["POST", "/api/@vitnode/core/users/sign_in"],
      ]),
    ).resolves.toEqual([200, 200, 429]);
  });
});

describe("rateLimiterMiddleware for public content writes", () => {
  it("counts public creates and edits against one budget", async () => {
    const app = buildApp({ contentWrite: { points: 2 } });

    await expect(
      statusesOf(app, [
        ["POST", "/api/@acme/forum/content/topics"],
        ["PATCH", "/api/@acme/forum/content/topics/7"],
        ["POST", "/api/@acme/forum/content/topics"],
      ]),
    ).resolves.toEqual([200, 200, 429]);
  });

  it.each([
    ["GET", "/api/@acme/forum/content/topics/7/edit"],
    ["PUT", "/api/@acme/forum/content/topics/7"],
    ["POST", "/api/@acme/forum/admin/content/topics"],
    ["PATCH", "/api/@acme/forum/admin/content/topics/7"],
    ["POST", "/api/@vitnode/core/users/sign_in"],
  ])("leaves %s %s to the other budgets", async (method, path) => {
    const app = buildApp({ contentWrite: { points: 2 }, auth: ROOMY });

    await expect(statusesOf(app, times(3, [method, path]))).resolves.toEqual([
      200, 200, 200,
    ]);
  });

  it("lets a reader who used up reads still post a comment", async () => {
    const app = buildApp({
      safety: { points: 10 },
      read: { points: 5 },
      write: ROOMY,
      contentWrite: { points: 2 },
    });
    const comment = "/api/@vitnode/forum/content/comments";

    // Hover prefetching on a forum page spends reads fast.
    const reads = await statusesOf(
      app,
      times(7, ["GET", "/api/@vitnode/forum/content/topics/42"]),
    );
    const posts = await statusesOf(app, times(3, ["POST", comment]));
    const capped = await app.request("/api/@vitnode/forum/topics/42/follow", {
      method: "PUT",
    });

    expect(reads).toEqual([...times(5, 200), 429, 429]);
    expect(posts).toEqual([200, 200, 429]);
    expect(capped.status).toBe(429);
    expect(capped.headers.get("X-RateLimit-Category")).toBe("safety");
  });
});

describe("rateLimiterMiddleware identity", () => {
  it("ignores client headers that try to buy a fresh budget", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VITNODE_TRUSTED_PROXY_HOPS", "0");
    const app = new Hono();
    const limiter = rateLimiterMiddleware({ read: { points: 2 } });
    app.use("*", clientIpMiddleware);
    app.use("*", limiter.requests);
    app.get("/", c => c.json({ ok: true }));

    const env = { incoming: { socket: { remoteAddress: "203.0.113.50" } } };
    const statuses: number[] = [];
    const attempts: Record<string, string>[] = [
      { "x-prefetch": "true" },
      { "x-forwarded-for": "198.51.100.1" },
      { "x-forwarded-for": "198.51.100.2", "x-prefetch": "true" },
    ];
    for (const headers of attempts) {
      statuses.push((await app.request("/", { headers }, env)).status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("rateLimiterMiddleware with Redis", () => {
  // Just enough of node-redis for `RateLimiterRedis`: its Lua script increments
  // a key that expires with the window.
  const fakeRedis = ({ down = false } = {}) => {
    const counters = new Map<string, number>();
    const client = {
      multi: () => ({}),
      eval: async (
        _script: string,
        {
          arguments: [points],
          keys: [key],
        }: { arguments: string[]; keys: string[] },
      ): Promise<[number, number]> => {
        if (down) return Promise.reject(new Error("ECONNREFUSED"));
        const consumed = (counters.get(key) ?? 0) + Number(points);
        counters.set(key, consumed);

        return Promise.resolve([consumed, 60_000]);
      },
    };

    return { counters, storeClient: client as unknown as CacheClient };
  };

  it("uses Redis when a client is set, and memory otherwise", () => {
    const limiter = createRateLimiter({
      ...ROOMY,
      keyPrefix: "test",
      storeClient: fakeRedis().storeClient,
    });

    expect(limiter).toBeInstanceOf(RateLimiterRedis);
    expect(createRateLimiter({ ...ROOMY, keyPrefix: "test" })).toBeInstanceOf(
      RateLimiterMemory,
    );
  });

  it("shares counters between instances, under one prefix per limiter", async () => {
    const redis = fakeRedis();
    const config = { read: { points: 2 } };
    const first = buildApp(config, { storeClient: redis.storeClient });
    const second = buildApp(config, { storeClient: redis.storeClient });

    await first.request("/api/topics");
    await second.request("/api/topics");
    await first.request("/api/@vitnode/core/users/sign_in", { method: "POST" });

    expect((await second.request("/api/topics")).status).toBe(429);
    expect([...redis.counters.keys()].sort()).toEqual(
      [
        `${RATE_LIMITER_KEY_PREFIXES.auth}:203.0.113.7`,
        `${RATE_LIMITER_KEY_PREFIXES.read}:203.0.113.7`,
        `${RATE_LIMITER_KEY_PREFIXES.safety}:203.0.113.7`,
        `${RATE_LIMITER_KEY_PREFIXES.write}:203.0.113.7`,
      ].sort(),
    );
  });

  it("keeps limiting in memory while Redis is down", async () => {
    const app = buildApp(
      { read: { points: 1 } },
      { storeClient: fakeRedis({ down: true }).storeClient },
    );

    await expect(
      statusesOf(app, times(2, ["GET", "/api/topics"])),
    ).resolves.toEqual([200, 429]);
  });
});

// Configs written before the categories existed. Plain objects, the way an
// older config file hands them over.
describe("legacy rateLimiter config", () => {
  it.each(METHODS.filter(method => method !== "OPTIONS"))(
    "keeps a top-level cap on every request (%s)",
    async method => {
      const legacyCap = { points: 2, duration: 60 };
      const app = buildApp(legacyCap);

      await expect(
        statusesOf(app, [
          ["GET", "/api/topics"],
          ["POST", "/api/topics"],
          [method, "/api/topics"],
        ]),
      ).resolves.toEqual([200, 200, 429]);
    },
  );

  it("warns once at boot that the top-level options moved", async () => {
    const warn = silenceWarnings();
    const legacyCap = { points: 1 };
    const app = buildApp(legacyCap);
    await statusesOf(app, times(3, ["GET", "/api/topics"]));

    expect(
      warn.mock.calls.filter(([line]) => String(line).includes("Deprecated")),
    ).toHaveLength(1);
  });
});

describe("resolveRateLimiterConfig", () => {
  it("fills every category with its defaults", () => {
    expect(resolveRateLimiterConfig(undefined)).toEqual(RATE_LIMITER_DEFAULTS);
  });

  it("overrides only the fields a category sets", () => {
    const resolved = resolveRateLimiterConfig({
      auth: { points: 3, blockDuration: 300 },
      read: { duration: 10 },
    });

    expect(resolved.auth).toEqual({
      points: 3,
      duration: 60,
      blockDuration: 300,
    });
    expect(resolved.read).toEqual({ points: 300, duration: 10 });
    expect(resolved.write).toEqual(RATE_LIMITER_DEFAULTS.write);
    expect(resolved.safety).toEqual(RATE_LIMITER_DEFAULTS.safety);
  });

  it("maps the deprecated top-level options onto safety with the old defaults", () => {
    const legacy = { points: 20, blockDuration: 30, auth: { points: 5 } };
    const legacyDuration = { duration: 120 };
    const resolved = resolveRateLimiterConfig(legacy);

    expect(resolved.safety).toEqual({
      points: 20,
      duration: 60,
      blockDuration: 30,
    });
    expect(resolveRateLimiterConfig(legacyDuration).safety).toEqual({
      points: 80,
      duration: 120,
    });
    expect(resolved.read).toEqual(RATE_LIMITER_DEFAULTS.read);
    expect(resolved.auth).toEqual({ points: 5, duration: 60 });
  });

  it("refuses top-level options next to safety", () => {
    const mixed = { points: 20, safety: { points: 500 } };

    expect(() => resolveRateLimiterConfig(mixed)).toThrow(
      /rateLimiter\.safety/,
    );
  });

  it("passes no option a category does not own", () => {
    const write = { points: 5, keyPrefix: "stolen", storeClient: {} };
    const resolved = resolveRateLimiterConfig({ write });

    expect(resolved.write).toEqual({ points: 5, duration: 60 });
  });

  it("gives every category its own key prefix", () => {
    const prefixes = Object.values(RATE_LIMITER_KEY_PREFIXES);

    expect(new Set(prefixes).size).toBe(prefixes.length);
    for (const prefix of prefixes) {
      expect(prefixes.filter(other => other.startsWith(`${prefix}:`))).toEqual(
        [],
      );
    }
    expect(prefixes).not.toContain("vitnode-api-rate-limiter");
  });
});

describe("rateLimiterCategoriesFor", () => {
  it.each([
    ["GET", "/api/topics", ["safety", "read"]],
    ["HEAD", "/api/topics", ["safety", "read"]],
    ["OPTIONS", "/api/@vitnode/core/users/sign_in", ["safety"]],
    ["DELETE", "/api/topics/7", ["safety", "write"]],
    ["PROPFIND", "/api/topics", ["safety", "write"]],
    ["POST", "/api/@vitnode/core/users/sign_in", ["safety", "write", "auth"]],
    [
      "PATCH",
      "/api/@acme/forum/content/topics/7",
      ["safety", "write", "contentWrite"],
    ],
    ["PATCH", "/api/@acme/forum/admin/content/topics/7", ["safety", "write"]],
  ])("%s %s spends %j", (method, path, categories) => {
    expect(rateLimiterCategoriesFor(method, path)).toEqual(categories);
  });
});

describe("rateLimitPathTemplate", () => {
  it.each([
    ["/api/@vitnode/core/users/sign_in", "/api/@vitnode/core/users/sign_in"],
    ["/api/topics/42", "/api/topics/:param"],
    ["/api/files/3f2b8c1e-9d4a-4b6f-8e2a-1c3d5e7f9a0b", "/api/files/:param"],
    ["/api/reset/9f86d081884c7d659a2feaa0c55ad015", "/api/reset/:param"],
    ["/api/topics/hello-world-2024", "/api/topics/:param"],
    ["/api/users/%40someone", "/api/users/:param"],
    ["/wp-admin/setup-config.php", "/wp-admin/setup-config.php"],
  ])("templates %s as %s", (path, template) => {
    expect(rateLimitPathTemplate(path)).toBe(template);
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
