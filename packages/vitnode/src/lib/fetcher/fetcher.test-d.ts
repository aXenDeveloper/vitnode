import { describe, expectTypeOf, it } from "vitest";

import { usersModule } from "@/api/modules/users/users.module";
import { fetcherClient } from "@/lib/fetcher-client";
import { coreFetcher } from "@/lib/fetcher/core";

describe("a route's arguments are part of its type", () => {
  it("accepts the module the API exports, not just a reference to it", async () => {
    const response = await coreFetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf(response.status).toEqualTypeOf<200>();
  });

  it("rejects a path the module does not serve", async () => {
    await coreFetcher(usersModule, {
      method: "get",
      module: "users",
      // @ts-expect-error -- not a route on `users`
      path: "/not-a-route",
    });
  });

  it("rejects a call that omits a required body", async () => {
    // @ts-expect-error -- `/sign_in` declares a body, so `args` is required
    await coreFetcher(usersModule, {
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects a body the route does not declare", async () => {
    await coreFetcher(usersModule, {
      // @ts-expect-error -- `nickname` is not on the sign-in schema
      args: { body: { email: "a@b.c", nickname: "x", password: "y" } },
      method: "post",
      module: "users",
      path: "/sign_in",
    });
  });

  it("rejects a call that omits a required path parameter", async () => {
    // @ts-expect-error -- `/devices/{publicId}` declares params
    await fetcherClient(usersModule, {
      method: "delete",
      module: "users",
      path: "/devices/{publicId}",
    });
  });

  it("infers the response body from the route's schema", async () => {
    const response = await coreFetcher(usersModule, {
      method: "get",
      module: "users",
      path: "/session",
    });

    expectTypeOf((await response.json()).user).not.toBeAny();
  });
});
