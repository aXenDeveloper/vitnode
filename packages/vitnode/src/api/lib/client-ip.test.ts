import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { TrustProxyConfig } from "./client-ip";

import { clientIpMiddleware } from "./client-ip";

interface Env {
  Variables: { ipAddress: string };
}

/**
 * Runs one request through the middleware and reports the address it settled
 * on. `socket` stands in for the runtime's connection info, in the shape
 * `@hono/node-server` exposes it.
 */
const resolve = async ({
  headers,
  socket,
  trustProxy,
}: {
  headers?: Record<string, string>;
  socket?: string;
  trustProxy?: TrustProxyConfig;
}): Promise<string> => {
  const app = new Hono<Env>();
  app.use("*", clientIpMiddleware(trustProxy));
  app.get("/", c => c.text(c.get("ipAddress")));

  const res = await app.request(
    "/",
    { headers },
    socket === undefined
      ? undefined
      : { incoming: { socket: { remoteAddress: socket } } },
  );

  return await res.text();
};

describe("clientIpMiddleware", () => {
  describe("with no proxy configured", () => {
    it("uses the socket address", async () => {
      await expect(resolve({ socket: "203.0.113.7" })).resolves.toBe(
        "203.0.113.7",
      );
    });

    it("ignores a forwarded header entirely", async () => {
      // The regression this guards: the old resolver walked sixteen
      // client-settable headers and took the first one present, so any caller
      // could name themselves and get a fresh rate-limit bucket per request.
      await expect(
        resolve({
          socket: "203.0.113.7",
          headers: { "x-forwarded-for": "9.9.9.9" },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it.each([
      "x-real-ip",
      "cf-connecting-ip",
      "true-client-ip",
      "client-ip",
      "forwarded",
    ])("ignores %s", async header => {
      await expect(
        resolve({ socket: "203.0.113.7", headers: { [header]: "9.9.9.9" } }),
      ).resolves.toBe("203.0.113.7");
    });

    it("falls back to localhost when the runtime exposes no socket", async () => {
      await expect(resolve({})).resolves.toBe("127.0.0.1");
    });
  });

  describe("behind one proxy", () => {
    it("reads the address the proxy observed", async () => {
      await expect(
        resolve({
          trustProxy: true,
          socket: "10.0.0.1",
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("steps over an address the client forged", async () => {
      // The client sent `9.9.9.9`; the proxy appended what it actually saw. One
      // hop means one entry from the right, which is the proxy's word and not
      // the client's.
      await expect(
        resolve({
          trustProxy: true,
          socket: "10.0.0.1",
          headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.7" },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("survives a forged chain of any length", async () => {
      const forged = Array.from({ length: 20 }, (_, i) => `9.9.9.${i}`).join(
        ", ",
      );

      await expect(
        resolve({
          trustProxy: 1,
          socket: "10.0.0.1",
          headers: { "x-forwarded-for": `${forged}, 203.0.113.7` },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("falls back to the socket when the proxy sent no header", async () => {
      await expect(
        resolve({ trustProxy: true, socket: "10.0.0.1" }),
      ).resolves.toBe("10.0.0.1");
    });
  });

  describe("behind two proxies", () => {
    it("reads past both of them", async () => {
      await expect(
        resolve({
          trustProxy: 2,
          socket: "10.0.0.1",
          headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.4" },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("steps over a forgery, still", async () => {
      await expect(
        resolve({
          trustProxy: 2,
          socket: "10.0.0.1",
          headers: {
            "x-forwarded-for": "9.9.9.9, 203.0.113.7, 198.51.100.4",
          },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("takes the leftmost entry when the chain is shorter than the hop count", async () => {
      await expect(
        resolve({
          trustProxy: 5,
          socket: "10.0.0.1",
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
      ).resolves.toBe("203.0.113.7");
    });
  });

  it("trims whitespace around chain entries", async () => {
    await expect(
      resolve({
        trustProxy: true,
        socket: "10.0.0.1",
        headers: { "x-forwarded-for": "  203.0.113.7  " },
      }),
    ).resolves.toBe("203.0.113.7");
  });

  it("ignores empty entries in the chain", async () => {
    await expect(
      resolve({
        trustProxy: true,
        socket: "10.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.7, , " },
      }),
    ).resolves.toBe("203.0.113.7");
  });
});
