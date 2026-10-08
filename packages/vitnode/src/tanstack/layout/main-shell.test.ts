import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import type { MiddlewareConfigState } from "../auth/middleware-config";

import {
  DEFERRED_MIDDLEWARE_CONFIG,
  knownMiddlewareConfig,
  middlewareConfigQueryOptions,
  UNKNOWN_MIDDLEWARE_CONFIG,
} from "../auth/middleware-config";
import { setAuthTransport } from "../auth/transport";
import { intlQueryOptions } from "../i18n/query";
import { loadMainShell } from "./header";

let sessionReads = 0;

const unreachable = () => {
  throw new Error("the shell loaders call no mutation");
};

setAuthTransport({
  changePasswordFromReset: unreachable,
  completeSso: unreachable,
  finishAdminPasskeySignIn: unreachable,
  finishPasskeySignIn: unreachable,
  linkSso: unreachable,
  readSession: async () => {
    sessionReads += 1;

    return await Promise.resolve({ user: null });
  },
  requestPasswordReset: unreachable,
  signIn: unreachable,
  signOut: unreachable,
  signUp: unreachable,
  startAdminPasskeySignIn: unreachable,
  startPasskeySignIn: unreachable,
  startSso: unreachable,
});

const KNOWN_CONFIG = knownMiddlewareConfig({
  ai: { models: [] },
  bottomBar: [],
  isEmail: false,
  navigation: [],
  passkeys: false,
  password: true,
  sso: [],
});

const PRERENDERING = { isPrerendering: () => true };

const shellContext = (config: MiddlewareConfigState) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(middlewareConfigQueryOptions().queryKey, config);
  queryClient.setQueryData(intlQueryOptions({ locale: "en" }).queryKey, {
    locale: "en",
    messages: {},
  });

  return { locale: "en", queryClient };
};

beforeEach(() => {
  sessionReads = 0;
});

describe("loadMainShell", () => {
  it("renders the header for the visitor, so it reads the session", async () => {
    await loadMainShell(shellContext(KNOWN_CONFIG));

    expect(sessionReads).toBe(1);
  });

  it("leaves the visitor out of a prerendered page", async () => {
    await loadMainShell(shellContext(KNOWN_CONFIG), PRERENDERING);

    expect(sessionReads).toBe(0);
  });

  it("ships the header without asking the API for the navigation", async () => {
    const context = shellContext(KNOWN_CONFIG);

    await loadMainShell(context, PRERENDERING);

    expect(
      context.queryClient.getQueryData(middlewareConfigQueryOptions().queryKey),
    ).toEqual(DEFERRED_MIDDLEWARE_CONFIG);
  });

  it("renders the fallback header outside a prerender", async () => {
    await expect(
      loadMainShell(shellContext(UNKNOWN_MIDDLEWARE_CONFIG)),
    ).resolves.toBeUndefined();
  });
});
