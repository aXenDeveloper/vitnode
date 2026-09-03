// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { middlewareModule } from "@/api/modules/middleware/middleware.module";

import { clientModule, fetcherClient } from "./fetcher-client";

const middleware = clientModule<typeof middlewareModule>("@vitnode/core");

const lastInit = (fetchMock: ReturnType<typeof vi.fn>): RequestInit =>
  fetchMock.mock.calls.at(-1)?.[1] as RequestInit;

describe("fetcherClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    fetchMock = vi.fn(async () =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends cookies by default, so a cross-origin API still knows who is asking", async () => {
    await fetcherClient(middleware, {
      method: "get",
      module: "middleware",
      path: "/",
    });

    expect(lastInit(fetchMock).credentials).toBe("include");
  });

  it("lets a caller opt out", async () => {
    await fetcherClient(middleware, {
      method: "get",
      module: "middleware",
      options: { credentials: "omit" },
      path: "/",
    });

    expect(lastInit(fetchMock).credentials).toBe("omit");
  });

  it("keeps the caller's other request options", async () => {
    const controller = new AbortController();

    await fetcherClient(middleware, {
      method: "get",
      module: "middleware",
      options: { signal: controller.signal },
      path: "/",
    });

    const init = lastInit(fetchMock);
    expect(init.credentials).toBe("include");
    expect(init.signal).toBe(controller.signal);
  });
});
