// @vitest-environment node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runtimeImports } from "@/tests/import-graph";

const requestHeaders = new Headers();
const setCookie = vi.fn();

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => requestHeaders,
  getRequestIP: () => "203.0.113.9",
  getRequestUrl: () => new URL("https://app.example.com/login"),
  setCookie,
}));

const { defaultAuthTransport } = await import("./default-transport");
const onApi = await import("./server");

const here = dirname(fileURLToPath(import.meta.url));

const apiFetch = vi.fn<(url: string | URL, init?: RequestInit) => Response>();

/** A fresh answer per call, so the same status can be read by both adapters. */
const answers = (body: string, status: number) => {
  apiFetch.mockImplementation(() => {
    const headers = new Headers();
    headers.append("set-cookie", "vitnode_auth=relayed; Path=/; HttpOnly");

    return new Response(body, { headers, status });
  });
};

beforeEach(() => {
  apiFetch.mockReset();
  setCookie.mockReset();
  answers("{}", 200);
  vi.stubGlobal("fetch", apiFetch);
  vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");
  requestHeaders.set("cookie", "vitnode_auth=abc");
});

const SIGN_IN = { email: "test@test.com", password: "Test123!" };
const SIGN_UP = {
  captchaToken: "",
  email: "test@test.com",
  name: "Tester",
  password: "Test123!",
};
const SSO_CALLBACK = {
  code: "code-1",
  providerId: "google",
  state: "state-1",
};
const SSO_LINK = {
  password: "Test123!",
  providerId: "google",
  token: "a-token-long-enough",
};
const CHANGE_PASSWORD = {
  password: "Test123!",
  token: "a-token-long-enough",
  userId: 1,
};

/**
 * Runs one operation through both adapters and insists they agree.
 *
 * The whole point of the shared operations module: two transports that differ
 * only in which fetcher they call and whether they relay cookies cannot answer
 * the same status differently.
 */
const bothAgreeOn = async <TInput, TResult>(
  {
    browser,
    server,
  }: {
    browser: (input: TInput) => Promise<TResult>;
    server: (input: TInput) => Promise<TResult>;
  },
  input: TInput,
): Promise<TResult> => {
  const fromBrowser = await browser(input);
  const fromServer = await server(input);

  expect(fromServer).toEqual(fromBrowser);

  return fromBrowser;
};

const SIGN_IN_PAIR = {
  browser: defaultAuthTransport.signIn,
  server: onApi.signInOnApi,
};
const SIGN_OUT_PAIR = {
  browser: defaultAuthTransport.signOut,
  server: onApi.signOutOnApi,
};
const SIGN_UP_PAIR = {
  browser: defaultAuthTransport.signUp,
  server: onApi.signUpOnApi,
};
const START_SSO_PAIR = {
  browser: defaultAuthTransport.startSso,
  server: onApi.startSsoOnApi,
};
const COMPLETE_SSO_PAIR = {
  browser: defaultAuthTransport.completeSso,
  server: onApi.completeSsoOnApi,
};
const LINK_SSO_PAIR = {
  browser: defaultAuthTransport.linkSso,
  server: onApi.linkSsoOnApi,
};
const RESET_REQUEST_PAIR = {
  browser: defaultAuthTransport.requestPasswordReset,
  server: onApi.requestPasswordResetOnApi,
};
const CHANGE_PASSWORD_PAIR = {
  browser: defaultAuthTransport.changePasswordFromReset,
  server: onApi.changePasswordFromResetOnApi,
};

describe("the browser adapter and the server one, on the same status", () => {
  it.each([201, 403, 400, 429, 500])(
    "map a %i sign-in identically",
    async status => {
      answers("", status);

      await bothAgreeOn(SIGN_IN_PAIR, SIGN_IN);
    },
  );

  it.each([200, 403, 500])("map a %i sign-out identically", async status => {
    answers("", status);

    await bothAgreeOn(SIGN_OUT_PAIR, { isAdmin: true });
  });

  it.each([200, 404, 500])("map a %i SSO start identically", async status => {
    answers(
      JSON.stringify({ url: "https://provider.example/authorize" }),
      status,
    );

    await bothAgreeOn(START_SSO_PAIR, { providerId: "google" });
  });

  it("refuse the same non-http start URL", async () => {
    answers(JSON.stringify({ url: "javascript:alert(1)" }), 200);

    await expect(
      bothAgreeOn(START_SSO_PAIR, { providerId: "google" }),
    ).resolves.toEqual({ ok: false, reason: "server_error" });
  });

  it.each([200, 400, 404, 500])(
    "map a %i SSO callback identically",
    async status => {
      answers("", status);

      await bothAgreeOn(COMPLETE_SSO_PAIR, SSO_CALLBACK);
    },
  );

  it("read the same link offer off a 409 SSO callback", async () => {
    const offer = {
      email: "test@test.com",
      hasPassword: true,
      linkToken: "a-token-long-enough",
    };
    answers(JSON.stringify(offer), 409);

    await expect(bothAgreeOn(COMPLETE_SSO_PAIR, SSO_CALLBACK)).resolves.toEqual(
      {
        offer,
        ok: false,
        reason: "email_exists",
      },
    );
  });

  it.each([201, 400, 403, 404, 409, 500])(
    "map a %i SSO link identically",
    async status => {
      answers("", status);

      await bothAgreeOn(LINK_SSO_PAIR, SSO_LINK);
    },
  );

  it.each([201, 400, 429, 500])(
    "map a %i sign-up identically",
    async status => {
      answers(
        JSON.stringify({ email: "test@test.com", emailVerified: false }),
        status,
      );

      await bothAgreeOn(SIGN_UP_PAIR, SIGN_UP);
    },
  );

  it("read the same conflict reason off a 409 sign-up", async () => {
    answers("Email already exists", 409);

    await expect(bothAgreeOn(SIGN_UP_PAIR, SIGN_UP)).resolves.toEqual({
      ok: false,
      reason: "email_exists",
    });
  });

  it.each([201, 400, 429, 500])(
    "map a %i password reset request identically",
    async status => {
      answers("", status);

      await bothAgreeOn(RESET_REQUEST_PAIR, {
        captchaToken: "captcha-1",
        email: "test@test.com",
      });
    },
  );

  it.each([201, 400, 429, 500])(
    "map a %i password change identically",
    async status => {
      answers("", status);

      await bothAgreeOn(CHANGE_PASSWORD_PAIR, CHANGE_PASSWORD);
    },
  );

  it("read the same session payload", async () => {
    answers(JSON.stringify({ user: null }), 200);

    await expect(
      bothAgreeOn(
        {
          browser: defaultAuthTransport.readSession,
          server: onApi.readSessionOnApi,
        },
        undefined,
      ),
    ).resolves.toEqual({ user: null });
  });

  it("both refuse to answer an unusable session status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    answers("", 500);

    await expect(defaultAuthTransport.readSession()).rejects.toThrow(
      "The session could not be read.",
    );
    await expect(onApi.readSessionOnApi()).rejects.toThrow(
      "The session could not be read.",
    );
  });

  it("both answer server_error rather than throwing when the API is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    apiFetch.mockImplementation(() => {
      throw new TypeError("fetch failed");
    });

    await expect(bothAgreeOn(SIGN_IN_PAIR, SIGN_IN)).resolves.toEqual({
      ok: false,
      reason: "server_error",
    });
  });
});

/**
 * The relay is the one thing the two adapters may not share.
 *
 * A browser is already on the receiving end of `Set-Cookie`; a server render is
 * not, and has to copy the header onto its own answer. `allowSaveCookies` is
 * what does that, and it belongs to exactly the flows that mint or clear a
 * session.
 */
describe("the cookie relay on the server adapter", () => {
  const RELAYS = [
    ["sign-in", async () => await onApi.signInOnApi(SIGN_IN), 201],
    ["sign-out", async () => await onApi.signOutOnApi({}), 200],
    [
      "SSO start",
      async () => await onApi.startSsoOnApi({ providerId: "google" }),
      200,
    ],
    [
      "SSO callback",
      async () => await onApi.completeSsoOnApi(SSO_CALLBACK),
      200,
    ],
    ["SSO link", async () => await onApi.linkSsoOnApi(SSO_LINK), 201],
    ["sign-up", async () => await onApi.signUpOnApi(SIGN_UP), 201],
  ] as const;

  it.each(RELAYS)(
    "forwards the session cookie on %s",
    async (_name, call, status) => {
      answers(
        JSON.stringify({ url: "https://provider.example/authorize" }),
        status,
      );

      await call();

      expect(setCookie).toHaveBeenCalledWith(
        "vitnode_auth",
        "relayed",
        expect.objectContaining({ httpOnly: true }),
      );
    },
  );

  const NEVER_RELAYS = [
    [
      "a password reset request",
      async () =>
        await onApi.requestPasswordResetOnApi({
          captchaToken: "captcha-1",
          email: "test@test.com",
        }),
    ],
    [
      "a token-based password change",
      async () => await onApi.changePasswordFromResetOnApi(CHANGE_PASSWORD),
    ],
  ] as const;

  it.each(NEVER_RELAYS)(
    "never forwards a cookie for %s",
    async (_name, call) => {
      // A 2xx, so `shouldSaveApiCookies` would say yes - the absence of
      // `allowSaveCookies` is the only thing stopping it, and it must stay absent.
      answers("", 201);

      await call();

      expect(setCookie).not.toHaveBeenCalled();
    },
  );

  it("relays only on the six flows that carry a session", async () => {
    answers("", 201);

    for (const [, call] of NEVER_RELAYS) await call();

    expect(setCookie).not.toHaveBeenCalled();
    expect(RELAYS).toHaveLength(6);
  });
});

describe("the browser adapter", () => {
  it("never relays a cookie, whatever the API sends", async () => {
    answers(JSON.stringify({ url: "https://provider.example/authorize" }), 201);

    await defaultAuthTransport.signIn(SIGN_IN);
    await defaultAuthTransport.signUp(SIGN_UP);
    await defaultAuthTransport.linkSso(SSO_LINK);

    expect(setCookie).not.toHaveBeenCalled();
  });

  it("imports no server-only module of its own", () => {
    const imports = runtimeImports(join(here, "default-transport.ts"));

    expect(imports).not.toContain("@/tanstack/fetcher/server");
    expect(imports).not.toContain("@tanstack/react-start/server-only");
    expect(imports.some(one => one.endsWith("/server"))).toBe(false);
    // The universal fetcher and the plugin id, which are safe in both
    // runtimes - that pair is the whole transport surface it may reach.
    expect(imports).toContain("@/tanstack/fetcher");
    expect(imports).toContain("@/config");
    expect(imports).not.toContain("@/lib/fetcher-client");
  });

  it("shares its request mapping with the server adapter", () => {
    for (const path of ["default-transport.ts", "server.ts"]) {
      expect(runtimeImports(join(here, path))).toContain(
        "./transport-operations",
      );
    }
  });
});

describe("the shared operations module", () => {
  it("names neither fetcher, so neither runtime is baked in", () => {
    const imports = runtimeImports(join(here, "transport-operations.ts"));

    expect(imports).toEqual(["./api-helpers", "./contract"]);
  });
});

describe("the server adapter", () => {
  it("still exports every OnApi call an application may import", () => {
    for (const name of [
      "changePasswordFromResetOnApi",
      "completeSsoOnApi",
      "linkSsoOnApi",
      "readSessionOnApi",
      "requestPasswordResetOnApi",
      "signInOnApi",
      "signOutOnApi",
      "signUpOnApi",
      "startSsoOnApi",
    ]) {
      expect(onApi).toHaveProperty(name);
      expect(onApi[name as keyof typeof onApi]).toBeTypeOf("function");
    }
  });
});
