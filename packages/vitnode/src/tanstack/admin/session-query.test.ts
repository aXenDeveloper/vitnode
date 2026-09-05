import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import type { AdminSessionReadResult } from "./session-api";

import {
  adminSessionQueryOptions,
  ensureAdminAccess,
  invalidateAdminSession,
  prefetchAdminAccess,
  preloadAdminAccess,
} from "./session-query";
import {
  ADMIN_SESSION_QUERY_KEY,
  AdminSessionUnavailableError,
  removeAdminSession,
} from "./state";
import { setAdminTransport } from "./transport";

let nextRead: AdminSessionReadResult = { status: "denied" };
let reads = 0;

setAdminTransport({
  readAdminSession: async () => {
    reads += 1;

    return await Promise.resolve(nextRead);
  },
});

/** Two different administrators, told apart by the one field a test can see. */
const adminA = {
  session: {
    permissions: {
      permissions: [
        { module: "users", permission: "can_delete", plugin: "@vitnode/core" },
      ],
      root: true,
    },
    user: { id: 1 },
  },
  status: "granted",
} as unknown as AdminSessionReadResult;

const adminB = {
  session: {
    permissions: { permissions: [], root: false },
    user: { id: 2 },
  },
  status: "granted",
} as unknown as AdminSessionReadResult;

const client = () => new QueryClient();

beforeEach(() => {
  nextRead = { status: "denied" };
  reads = 0;
});

describe("the canonical admin session query", () => {
  it("is the one entry every guard, provider and gate reads", () => {
    expect(adminSessionQueryOptions().queryKey).toEqual(
      ADMIN_SESSION_QUERY_KEY,
    );
  });

  it("asks once and lets the failure surface", () => {
    // A route guard, not background content: a navigation is blocked for as long
    // as this takes, and retrying a 429 is the thing the rate limiter is asking
    // the app to stop doing.
    expect(adminSessionQueryOptions().retry).toBe(false);
  });

  it("trusts nothing it has already read", () => {
    expect(adminSessionQueryOptions().staleTime).toBe(0);
  });

  it("does not keep a detached entry for the default five minutes", () => {
    const gcTime = adminSessionQueryOptions().gcTime;

    expect(gcTime).toBeGreaterThan(0);
    expect(gcTime).toBeLessThan(5 * 60_000);
  });
});

describe("what a read resolves to", () => {
  it("resolves a granted session", async () => {
    nextRead = adminA;

    await expect(ensureAdminAccess(client())).resolves.toMatchObject({
      status: "granted",
    });
  });

  it("resolves a 403 as a denial", async () => {
    nextRead = { status: "denied" };

    await expect(ensureAdminAccess(client())).resolves.toEqual({
      status: "denied",
    });
  });

  it.each([
    ["an API failure", { httpStatus: 500, status: "api_error" } as const],
    ["a rate limit", { httpStatus: 429, status: "api_error" } as const],
    ["a network failure", { status: "network_error" } as const],
  ])("rejects on %s rather than denying access", async (_label, failure) => {
    nextRead = failure;

    await expect(ensureAdminAccess(client())).rejects.toBeInstanceOf(
      AdminSessionUnavailableError,
    );
  });

  it("carries which failure it was, so an operator can be told", async () => {
    nextRead = { httpStatus: 429, status: "api_error" };

    const error = await ensureAdminAccess(client()).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(AdminSessionUnavailableError);
    expect((error as AdminSessionUnavailableError).failure).toEqual({
      httpStatus: 429,
      status: "api_error",
    });
  });

  it("says nothing about the API in the message it shows", async () => {
    nextRead = { httpStatus: 500, status: "api_error" };

    const error = await ensureAdminAccess(client()).catch(
      (caught: unknown) => caught,
    );

    // The failing URL and the server's error text stay in the server log. This
    // sentence is rendered in a browser.
    expect((error as Error).message).not.toMatch(/http|:\/\/|\bat\b/i);
  });
});

describe("a hover reuses the answer a navigation would not", () => {
  it("asks once for a run of preloads", async () => {
    nextRead = adminA;
    const queryClient = client();

    await preloadAdminAccess(queryClient);
    await preloadAdminAccess(queryClient);
    await preloadAdminAccess(queryClient);

    expect(reads).toBe(1);
  });

  it("still asks on the navigation that follows them", async () => {
    nextRead = adminA;
    const queryClient = client();

    await preloadAdminAccess(queryClient);
    expect(reads).toBe(1);

    // The click. `_admin.beforeLoad` runs again with `preload: false`, and this
    // is the read it makes - `staleTime: 0`, so the API is asked whatever the
    // hover left in the cache. The whole revocation guarantee is this line.
    await ensureAdminAccess(queryClient);

    expect(reads).toBe(2);
  });

  it("does not leave its stale window behind on the entry", async () => {
    nextRead = adminA;
    const queryClient = client();

    await preloadAdminAccess(queryClient);
    await ensureAdminAccess(queryClient);
    // Two navigations in a row still ask twice: the override travelled with the
    // one call that wanted it rather than being written onto the query.
    await ensureAdminAccess(queryClient);

    expect(reads).toBe(3);
  });

  it("reads the same entry the guard and the shell read", async () => {
    nextRead = adminA;
    const queryClient = client();

    await preloadAdminAccess(queryClient);

    expect(queryClient.getQueryData(ADMIN_SESSION_QUERY_KEY)).toMatchObject({
      status: "granted",
    });
  });

  it("rejects a failed read rather than answering with a denial", async () => {
    nextRead = { status: "api_error" };
    const queryClient = client();

    await expect(preloadAdminAccess(queryClient)).rejects.toBeInstanceOf(
      AdminSessionUnavailableError,
    );
  });

  /** A sign-in drops the entry, so the next hover asks rather than reusing. */
  it("asks again once the identity boundary has dropped the entry", async () => {
    nextRead = adminA;
    const queryClient = client();
    await preloadAdminAccess(queryClient);

    removeAdminSession(queryClient);
    await preloadAdminAccess(queryClient);

    expect(reads).toBe(2);
  });
});

describe("staleness", () => {
  it("re-reads on every guard, because a permission may have been revoked", async () => {
    nextRead = adminA;
    const queryClient = client();

    await ensureAdminAccess(queryClient);
    await ensureAdminAccess(queryClient);

    expect(reads).toBe(2);
  });

  it("shares one in-flight request between two guards in one navigation", async () => {
    nextRead = adminA;
    const queryClient = client();

    await Promise.all([
      ensureAdminAccess(queryClient),
      ensureAdminAccess(queryClient),
    ]);

    expect(reads).toBe(1);
  });

  it("marks the entry stale without blanking it", async () => {
    nextRead = adminA;
    const queryClient = client();
    await ensureAdminAccess(queryClient);

    await invalidateAdminSession(queryClient);

    // Still there to render from while the fresh answer is fetched - the
    // difference between an invalidation and a removal.
    expect(queryClient.getQueryData(ADMIN_SESSION_QUERY_KEY)).toMatchObject({
      status: "granted",
    });
  });
});

describe("one administrator's answer is never reused for the next", () => {
  it("leaves nothing to render after a removal", async () => {
    nextRead = adminA;
    const queryClient = client();
    await ensureAdminAccess(queryClient);

    removeAdminSession(queryClient);

    expect(queryClient.getQueryData(ADMIN_SESSION_QUERY_KEY)).toBeUndefined();
  });

  it("answers with B after A is forgotten", async () => {
    const queryClient = client();

    nextRead = adminA;
    const first = await ensureAdminAccess(queryClient);
    expect(first).toMatchObject({ session: { user: { id: 1 } } });

    removeAdminSession(queryClient);
    nextRead = adminB;

    const second = await ensureAdminAccess(queryClient);
    expect(second).toMatchObject({ session: { user: { id: 2 } } });
  });

  it("does not let A's root permission survive into B's session", async () => {
    const queryClient = client();

    nextRead = adminA;
    await ensureAdminAccess(queryClient);
    removeAdminSession(queryClient);
    nextRead = adminB;
    const access = await ensureAdminAccess(queryClient);

    expect(
      access.status === "granted" ? access.session.permissions.root : true,
    ).toBe(false);
  });

  it("keeps two clients' answers apart, as one server request per admin does", async () => {
    // The server side of the same property: `getRouter()` builds a QueryClient
    // per request, so two administrators being rendered at once never share one.
    const a = client();
    const b = client();

    nextRead = adminA;
    await ensureAdminAccess(a);
    nextRead = adminB;
    await ensureAdminAccess(b);

    expect(a.getQueryData(ADMIN_SESSION_QUERY_KEY)).toMatchObject({
      session: { user: { id: 1 } },
    });
    expect(b.getQueryData(ADMIN_SESSION_QUERY_KEY)).toMatchObject({
      session: { user: { id: 2 } },
    });
  });
});

describe("the tolerant read the sign-in screen uses", () => {
  it("answers with the decision when there was one", async () => {
    nextRead = adminA;

    await expect(prefetchAdminAccess(client())).resolves.toMatchObject({
      status: "granted",
    });
  });

  it("answers undefined rather than throwing when the read failed", async () => {
    nextRead = { httpStatus: 500, status: "api_error" };

    await expect(prefetchAdminAccess(client())).resolves.toBeUndefined();
  });

  it("does not turn a failure into a session it can redirect on", async () => {
    nextRead = { status: "network_error" };

    const access = await prefetchAdminAccess(client());

    expect(access).toBeUndefined();
    expect(access?.status).not.toBe("granted");
  });
});
