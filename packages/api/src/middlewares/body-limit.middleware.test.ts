import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { bodyLimitMiddleware } from "./body-limit.middleware";

const MAX_SIZE = 8;

/**
 * A request object that quacks like a `Request` but is not one - like the
 * objects TanStack Start's server hands the API. `new Request(it, init)` reads
 * it as a URL string and throws, which is what turned hono's `bodyLimit` into a
 * `500` for every request without a `Content-Length`.
 */
const toForeignRequest = (request: Request) => ({
  body: request.body,
  headers: request.headers,
  method: request.method,
  signal: request.signal,
  url: request.url,
});

const app = new Hono();
app.use(async (c, next) => {
  if (c.req.header("x-foreign-request")) {
    c.req.raw = toForeignRequest(c.req.raw) as unknown as Request;
  }
  await next();
});
app.use(
  bodyLimitMiddleware({
    maxSize: MAX_SIZE,
    onError: c => c.json({ error: "Payload Too Large" }, 413),
  }),
);
app.all("/", async c => c.text(`echo:${await c.req.text()}`));

const streamOf = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

const streamedRequest = (
  chunks: string[],
  headers: Record<string, string> = {},
) =>
  new Request("http://localhost/", {
    body: streamOf(...chunks),
    // @ts-expect-error - undici requires `duplex` for a stream body; lib.dom lacks it.
    duplex: "half",
    headers,
    method: "POST",
  });

describe("bodyLimitMiddleware", () => {
  it("passes a request without a body through", async () => {
    const res = await app.request("/", { method: "DELETE" });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("echo:");
  });

  it.each([
    { body: "12345678", status: 200 },
    { body: "123456789", status: 413 },
  ])(
    "answers $status for a $body.length-byte body with a Content-Length",
    async ({ body, status }) => {
      const res = await app.request("/", { body, method: "POST" });

      expect(res.status).toBe(status);
    },
  );

  it("hands a streamed body under the limit to the handler unchanged", async () => {
    const res = await app.request(streamedRequest(["abc", "def"]));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("echo:abcdef");
  });

  it("answers onError for a streamed body over the limit", async () => {
    const res = await app.request(streamedRequest(["abcde", "fghij"]));

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload Too Large" });
  });

  it("hands an empty streamed body to the handler", async () => {
    const res = await app.request(streamedRequest([]));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("echo:");
  });

  it("re-attaches a streamed body when the request is not a global Request", async () => {
    const res = await app.request(
      streamedRequest(["abc", "def"], { "x-foreign-request": "1" }),
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("echo:abcdef");
  });
});
