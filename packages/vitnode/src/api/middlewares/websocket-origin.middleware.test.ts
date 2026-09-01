import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { websocketOriginMiddleware } from "./websocket-origin.middleware";

const upgrade = async (
  origin: string | undefined,
  options?: { origin?: string[] },
): Promise<Response> => {
  const app = new Hono();
  app.get("/ws", websocketOriginMiddleware(options), c => c.text("upgraded"));

  return await app.request(
    "/ws",
    origin === undefined ? {} : { headers: { origin } },
  );
};

describe("websocketOriginMiddleware", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://web.example");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the configured web origin", async () => {
    const res = await upgrade("https://web.example");

    expect(res.status).toBe(200);
  });

  it("allows the configured API origin", async () => {
    const res = await upgrade("https://api.example");

    expect(res.status).toBe(200);
  });

  it("allows an extra origin the app passes in", async () => {
    const res = await upgrade("https://admin.example", {
      origin: ["https://admin.example"],
    });

    expect(res.status).toBe(200);
  });

  it("refuses another site", async () => {
    // The attack: `evil.example` opens `wss://api.example/ws`, the browser
    // attaches the visitor's session cookie because the same-origin policy does
    // not govern WebSockets, and the socket is registered as that visitor.
    const res = await upgrade("https://evil.example");

    expect(res.status).toBe(403);
  });

  it("refuses a look-alike prefix", async () => {
    const res = await upgrade("https://web.example.evil.example");

    expect(res.status).toBe(403);
  });

  it("refuses the right host on the wrong scheme", async () => {
    const res = await upgrade("http://web.example");

    expect(res.status).toBe(403);
  });

  it("refuses the right host on a different port", async () => {
    const res = await upgrade("https://web.example:8443");

    expect(res.status).toBe(403);
  });

  it("allows a handshake with no Origin at all", async () => {
    // Browsers always send one, so this is a non-browser client - which carries
    // no ambient cookies to be ridden.
    const res = await upgrade(undefined);

    expect(res.status).toBe(200);
  });

  it("normalises a configured origin given as a full URL", async () => {
    const res = await upgrade("https://admin.example", {
      origin: ["https://admin.example/admin/"],
    });

    expect(res.status).toBe(200);
  });
});
