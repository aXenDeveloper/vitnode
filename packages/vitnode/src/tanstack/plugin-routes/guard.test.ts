import type { QueryClient } from "@tanstack/react-query";

import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { SessionApi } from "../auth/session-api";

import { pluginRouteGuard } from "./guard";

const sessionOf = (user: null | { id: number }): SessionApi =>
  ({ user }) as unknown as SessionApi;

const contextWith = (user: null | { id: number }) => ({
  queryClient: {
    fetchQuery: async () => Promise.resolve(sessionOf(user)),
  } as unknown as QueryClient,
});

const location = { hash: "", pathname: "/example/private", searchStr: "" };

/** The redirect a guard threw, as the options it carries. */
const redirectFrom = async (
  run: () => Promise<unknown>,
): Promise<Record<string, unknown>> => {
  try {
    await run();
  } catch (error) {
    expect(isRedirect(error)).toBe(true);

    return (error as { options: Record<string, unknown> }).options;
  }

  throw new Error("Expected a redirect.");
};

describe("pluginRouteGuard", () => {
  it("gives a route with no requirement no guard at all", () => {
    expect(pluginRouteGuard(null)).toBeUndefined();
  });

  it.each(["authenticated", "guest"] as const)(
    "gives a route requiring %s one",
    requires => {
      expect(typeof pluginRouteGuard(requires)).toBe("function");
    },
  );
});

describe("a plugin route that requires a signed-in visitor", () => {
  const guard = () => pluginRouteGuard("authenticated");

  it("hands the resolved session down as route context", async () => {
    const result = await guard()?.({
      context: contextWith({ id: 7 }),
      location,
      search: {},
    });

    expect(result).toMatchObject({ auth: { isAuthenticated: true } });
  });

  it("sends an anonymous visitor to the login page, carrying where they were", async () => {
    const options = await redirectFrom(
      async () =>
        await guard()?.({ context: contextWith(null), location, search: {} }),
    );

    expect(options).toMatchObject({
      search: { returnTo: "/example/private" },
      to: "/login",
    });
    expect(options.href).toBeUndefined();
  });
});

describe("a plugin route that only makes sense signed out", () => {
  const guard = () => pluginRouteGuard("guest");

  it("lets an anonymous visitor through", async () => {
    await expect(
      guard()?.({ context: contextWith(null), location, search: {} }),
    ).resolves.toBeUndefined();
  });

  it("sends a signed-in visitor where they were heading", async () => {
    const options = await redirectFrom(
      async () =>
        await guard()?.({
          context: contextWith({ id: 7 }),
          location,
          search: { returnTo: "/example/guide" },
        }),
    );

    expect(options).toMatchObject({ to: "/example/guide" });
  });

  it.each([
    ["an absolute URL", "https://evil.invalid/x"],
    ["the login page", "/login"],
    ["nothing", undefined],
  ])(
    "refuses %s as a destination and falls back to /",
    async (_l, returnTo) => {
      const options = await redirectFrom(
        async () =>
          await guard()?.({
            context: contextWith({ id: 7 }),
            location,
            search: { returnTo },
          }),
      );

      expect(options).toMatchObject({ to: "/" });
    },
  );
});
