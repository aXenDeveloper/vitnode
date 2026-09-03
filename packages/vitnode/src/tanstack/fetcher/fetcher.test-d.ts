import { describe, expectTypeOf, it } from "vitest";

import type { usersModule } from "@/api/modules/users/users.module";

import { clientModule } from "@/lib/fetcher-client";

import { createApiClient, fetcher } from "./index";

const users = clientModule<typeof usersModule>("@vitnode/core");

describe("the universal fetcher keeps the route in the type", () => {
  it("infers the status and the body from the route's schema", async () => {
    const response = await fetcher(users, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf(response.status).toEqualTypeOf<200>();
    expectTypeOf((await response.json()).user).not.toBeAny();
  });

  it("rejects a path the module does not serve", async () => {
    await fetcher(users, {
      method: "get",
      module: "users",
      // @ts-expect-error -- not a route on `users`
      path: "/not-a-route",
    });
  });

  it("rejects a method the route does not answer", async () => {
    await fetcher(users, {
      // @ts-expect-error -- `/session` is a `get`
      method: "post",
      module: "users",
      path: "/session",
    });
  });

  it("rejects a call that omits a required body", async () => {
    // @ts-expect-error -- `/sign_in` declares a body, so `args` is required
    await fetcher(users, {
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects a body the route does not declare", async () => {
    await fetcher(users, {
      // @ts-expect-error -- `nickname` is not on the sign-in schema
      args: { body: { email: "a@b.c", nickname: "x", password: "y" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects a call that omits a required path parameter", async () => {
    // @ts-expect-error -- `/devices/{publicId}` declares params
    await fetcher(users, {
      method: "delete",
      module: "users",
      path: "/devices/{publicId}",
    });
  });
});

describe("the universal fetcher offers only what both runtimes can honour", () => {
  it("rejects the cookie relay, which is the server transport's", async () => {
    await fetcher(users, {
      // @ts-expect-error -- `allowSaveCookies` is on `tanstack/fetcher/server`
      allowSaveCookies: true,
      args: { body: { email: "a@b.c", password: "secret" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects forwarded headers", async () => {
    await fetcher(users, {
      // @ts-expect-error -- a browser cannot forge request headers
      additionalHeaders: { Cookie: "vitnode_auth=stolen" },
      method: "get",
      module: "users",
      path: "/session",
    });
  });

  it("rejects an origin override", async () => {
    await fetcher(users, {
      method: "get",
      module: "users",
      // @ts-expect-error -- the browser calls its own origin
      origin: "https://api.example.com",
      path: "/session",
    });
  });

  it("still accepts the options both runtimes share", async () => {
    const controller = new AbortController();

    await fetcher(users, {
      method: "get",
      module: "users",
      options: { signal: controller.signal },
      path: "/session",
    });
  });
});


describe("a plugin API client", () => {
  const usersApi = createApiClient<typeof usersModule>("@vitnode/core");

  it("keeps route and response inference without a module reference at the call site", async () => {
    const response = await usersApi.fetch({
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf(response.status).toEqualTypeOf<200>();
    expectTypeOf((await response.json()).user).not.toBeAny();
  });

  it("rejects an invalid route", async () => {
    await usersApi.fetch({
      method: "get",
      module: "users",
      // @ts-expect-error -- not a route on users
      path: "/not-a-route",
    });
  });
});
