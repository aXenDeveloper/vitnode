import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INSECURE_CRON_SECRETS } from "@/lib/config";
import {
  FORWARDED_SIGNATURE_HEADER,
  FORWARDED_SIGNATURE_MAX_AGE_MS,
  signForwardedFor,
} from "@/lib/fetcher/forwarded-signature.server";

import { clientIpMiddleware } from "./client-ip";

interface Env {
  Variables: { ipAddress: string };
}

const resolve = async ({
  env,
  headers,
  socket,
}: {
  env?: Record<string, unknown>;
  headers?: Record<string, string>;
  socket?: string;
}): Promise<string> => {
  const app = new Hono<Env>();
  app.use("*", clientIpMiddleware);
  app.get("/", c => c.text(c.get("ipAddress")));

  const res = await app.request(
    "/",
    { headers },
    env ??
      (socket === undefined
        ? undefined
        : { incoming: { socket: { remoteAddress: socket } } }),
  );

  return await res.text();
};

describe("clientIpMiddleware", () => {
  it("uses the socket address", async () => {
    await expect(resolve({ socket: "203.0.113.7" })).resolves.toBe(
      "203.0.113.7",
    );
  });

  it("falls back to localhost when the runtime exposes no socket", async () => {
    await expect(resolve({})).resolves.toBe("127.0.0.1");
  });

  it.each([
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "client-ip",
    "forwarded",
  ])("ignores the client-settable %s header", async header => {
    await expect(
      resolve({ socket: "203.0.113.7", headers: { [header]: "9.9.9.9" } }),
    ).resolves.toBe("203.0.113.7");
  });

  it("ignores a forwarded chain even with no socket to fall back to", async () => {
    await expect(
      resolve({ headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.7" } }),
    ).resolves.toBe("127.0.0.1");
  });

  it("uses the address a host app hands over when it mounts the API in-process", async () => {
    await expect(
      resolve({ env: { clientAddress: "203.0.113.7" } }),
    ).resolves.toBe("203.0.113.7");
  });

  describe("behind trusted proxies", () => {
    const PROXY = "10.0.0.5";

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("takes the hop the closest trusted proxy appended", async () => {
      vi.stubEnv("VITNODE_TRUSTED_PROXY_HOPS", "1");

      await expect(
        resolve({
          socket: PROXY,
          headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.7" },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("skips one hop per trusted proxy", async () => {
      vi.stubEnv("VITNODE_TRUSTED_PROXY_HOPS", "2");

      await expect(
        resolve({
          socket: PROXY,
          headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.7, 10.0.0.4" },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("applies to the address a host app hands over", async () => {
      vi.stubEnv("VITNODE_TRUSTED_PROXY_HOPS", "1");

      await expect(
        resolve({
          env: { clientAddress: PROXY },
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
      ).resolves.toBe("203.0.113.7");
    });

    it("keeps the socket when the trusted hop is not an IP address", async () => {
      vi.stubEnv("VITNODE_TRUSTED_PROXY_HOPS", "1");

      await expect(
        resolve({
          socket: PROXY,
          headers: { "x-forwarded-for": "not-an-ip" },
        }),
      ).resolves.toBe(PROXY);
    });

    it("never reads a forwarded chain without a socket to anchor it", async () => {
      vi.stubEnv("VITNODE_TRUSTED_PROXY_HOPS", "1");

      await expect(
        resolve({ headers: { "x-forwarded-for": "203.0.113.7" } }),
      ).resolves.toBe("127.0.0.1");
    });
  });

  describe("with a signed forwarded address from the web server", () => {
    const SECRET = "a-long-random-cron-secret";
    const SOCKET = "10.0.0.5";

    const signed = (
      forwardedFor: string,
      options: { now?: number; secret?: string } = {},
    ) => ({
      "x-forwarded-for": forwardedFor,
      [FORWARDED_SIGNATURE_HEADER]: signForwardedFor({
        forwardedFor,
        now: options.now,
        secret: options.secret ?? SECRET,
      }),
    });

    beforeEach(() => {
      vi.stubEnv("CRON_SECRET", SECRET);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("uses the closest hop of a correctly signed chain", async () => {
      await expect(
        resolve({ socket: SOCKET, headers: signed("9.9.9.9, 203.0.113.7") }),
      ).resolves.toBe("203.0.113.7");
    });

    it("ignores a chain signed with another secret", async () => {
      await expect(
        resolve({
          socket: SOCKET,
          headers: signed("203.0.113.7", { secret: "guessed" }),
        }),
      ).resolves.toBe(SOCKET);
    });

    it("ignores a signature whose chain was altered", async () => {
      const headers = signed("203.0.113.7");

      await expect(
        resolve({
          socket: SOCKET,
          headers: { ...headers, "x-forwarded-for": "198.51.100.1" },
        }),
      ).resolves.toBe(SOCKET);
    });

    it("ignores a signature older than the allowed age", async () => {
      await expect(
        resolve({
          socket: SOCKET,
          headers: signed("203.0.113.7", {
            now: Date.now() - FORWARDED_SIGNATURE_MAX_AGE_MS - 1000,
          }),
        }),
      ).resolves.toBe(SOCKET);
    });

    it("ignores a malformed signature", async () => {
      await expect(
        resolve({
          socket: SOCKET,
          headers: {
            "x-forwarded-for": "203.0.113.7",
            [FORWARDED_SIGNATURE_HEADER]: "not-a-signature",
          },
        }),
      ).resolves.toBe(SOCKET);
    });

    it("ignores a signed hop that is not an IP address", async () => {
      await expect(
        resolve({ socket: SOCKET, headers: signed("not-an-ip") }),
      ).resolves.toBe(SOCKET);
    });

    it("ignores the fetcher's unknown-address placeholder", async () => {
      await expect(
        resolve({ socket: SOCKET, headers: signed("0.0.0.0") }),
      ).resolves.toBe(SOCKET);
    });

    it.each(INSECURE_CRON_SECRETS)(
      "trusts nothing while the cron secret is the published %s",
      async insecureSecret => {
        vi.stubEnv("CRON_SECRET", insecureSecret);

        await expect(
          resolve({
            socket: SOCKET,
            headers: signed("203.0.113.7", { secret: insecureSecret }),
          }),
        ).resolves.toBe(SOCKET);
      },
    );

    it("trusts nothing when the cron secret is unset", async () => {
      vi.stubEnv("CRON_SECRET", undefined);

      await expect(
        resolve({ socket: SOCKET, headers: signed("203.0.113.7") }),
      ).resolves.toBe(SOCKET);
    });
  });
});
