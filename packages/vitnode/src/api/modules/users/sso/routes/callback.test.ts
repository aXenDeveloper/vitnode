import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";
import type {
  SSOApiPlugin,
  SSOAuthorizationRequest,
  SSOProviderUser,
} from "@/api/models/sso";

import { pkceChallengeS256 } from "@/api/lib/sso-protocol";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { SSOModel } from "@/api/models/sso";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { verifySsoLinkToken } from "@/api/models/sso-link-token";
import { core_secrets } from "@/database/secrets";
import { core_users, core_users_sso } from "@/database/users";
import { createMemorySsoFlowStore } from "@/tests/sso-flow-store";

import { ssoUserModule } from "../sso.module";

const LINK_SECRET = "link-secret";

const PROVIDER_USER: SSOProviderUser = {
  avatarUrl: "https://lh3.googleusercontent.test/a/photo.png",
  email: "Alice@Example.test",
  firstName: "Alice",
  id: "google-alice",
  lastName: "Smith",
  username: "Alice Smith",
};

interface Account {
  email: string;
  emailVerified: boolean;
  id: number;
  password: null | string;
}

/** Answers each `select` by the table it reads, never by call order. */
const fakeDb = (accounts: Account[]) => {
  const inserts: { table: unknown; values: unknown }[] = [];
  const updates: unknown[] = [];
  const select = () => {
    let table: unknown;
    const chain = {
      from: (from: unknown) => {
        table = from;

        return chain;
      },
      innerJoin: () => chain,
      limit: () => chain,
      then: async (onFulfilled: (value: unknown) => unknown) =>
        await Promise.resolve(
          onFulfilled(
            table === core_secrets
              ? [{ value: LINK_SECRET }]
              : table === core_users
                ? accounts.map(({ email, id, password }) => ({
                    email,
                    id,
                    password,
                  }))
                : [],
          ),
        ),
      where: () => chain,
    };

    return chain;
  };
  const db = {
    insert: (table: unknown) => ({
      values: async (values: unknown) => {
        inserts.push({ table, values });
        await Promise.resolve();
      },
    }),
    select,
    transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      await run(db),
    update: () => ({
      set: (values: unknown) => ({
        where: async () => {
          updates.push(values);
          await Promise.resolve();
        },
      }),
    }),
  };

  return { db, inserts, updates };
};

const cookieHeader = (response: Response, jar: Map<string, string>) => {
  for (const line of response.headers.getSetCookie()) {
    const [pair = ""] = line.split(";");
    const [name = "", value = ""] = pair.split("=");
    if (value === "" || /max-age=0/i.test(line)) jar.delete(name);
    else jar.set(name, value);
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
};

const harness = ({
  accounts = [],
  emailAdapter = true,
  linked = new Map<
    string,
    { email: string; emailVerified: boolean; userId: number }
  >(),
  user = PROVIDER_USER,
}: {
  accounts?: Account[];
  emailAdapter?: boolean;
  linked?: Map<
    string,
    { email: string; emailVerified: boolean; userId: number }
  >;
  user?: SSOProviderUser;
} = {}) => {
  const requests: SSOAuthorizationRequest[] = [];
  const adapter = (
    id: string,
  ): SSOApiPlugin & {
    fetchToken: ReturnType<typeof vi.fn>;
    fetchUser: ReturnType<typeof vi.fn>;
  } => ({
    fetchToken: vi.fn(async () =>
      Promise.resolve({ access_token: "token", token_type: "Bearer" }),
    ),
    fetchUser: vi.fn(async () => Promise.resolve(user)),
    getUrl: request => {
      requests.push(request);

      return `https://${id}.example/oauth?state=${request.state}`;
    },
    id,
    name: id === "google" ? "Google" : "Discord",
    profileFields: ["avatar", "firstName", "lastName"],
  });
  const google = adapter("google");
  const discord = adapter("discord");
  const flow = createMemorySsoFlowStore();
  const { db, inserts, updates } = fakeDb(accounts);
  const send = vi.fn(async (_args: unknown) => Promise.resolve());
  let nextUserId = 100;

  vi.spyOn(SSOModel.prototype, "flowStore", "get").mockReturnValue(flow.store);
  vi.spyOn(SSOModel.prototype, "findLinkedUser").mockImplementation(
    async (providerId, accountId) =>
      Promise.resolve(linked.get(`${providerId}:${accountId}`) ?? null),
  );
  const createAccount = vi
    .spyOn(SSOModel.prototype, "createAccount")
    .mockImplementation(async () => Promise.resolve(nextUserId++));
  const createSession = vi
    .spyOn(SessionModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "session-token" });
  const createAdminSession = vi
    .spyOn(SessionAdminModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "admin-token" });
  const afterSignIn = vi
    .spyOn(SsoConnectionModel.prototype, "afterSignIn")
    .mockResolvedValue(undefined);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: {
        adminCookieExpires: 1000 * 60 * 60 * 24,
        adminCookieName: "vitnode_auth_admin",
        cookieDomain: undefined,
        cookie_expires: 1000 * 60 * 60 * 24 * 90,
        cookieName: "vitnode_auth",
        cookieSecure: true,
        deviceCookieExpires: 1000 * 60 * 60 * 24 * 365,
        deviceCookieName: "vitnode_device",
        passkeys: { enabled: false, problems: [] },
        password: { enabled: true },
        ssoAdapters: [google, discord],
      },
      email: emailAdapter ? { adapter: {} } : undefined,
    } as unknown as EnvVariablesVitNode["core"]);
    c.set("user", null as Context["var"]["user"]);
    c.set("db", db as unknown as Context["var"]["db"]);
    c.set("email", { send } as unknown as Context["var"]["email"]);
    c.set("i18n", {
      resolveLocale: () => "en",
    } as unknown as Context["var"]["i18n"]);
    c.set("ipAddress", "203.0.113.7");
    c.set("events", {
      emit: vi.fn(async () => Promise.resolve()),
    } as unknown as Context["var"]["events"]);
    await next();
  });
  app.route("/", ssoUserModule.hono);

  const jar = new Map<string, string>();
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await app.request(path, {
      ...init,
      headers: { ...init.headers, cookie: cookieHeader(new Response(), jar) },
    });
    cookieHeader(response, jar);

    return response;
  };

  const start = async (providerId = "google") => {
    const response = await request(`/${providerId}`, { method: "POST" });
    const { url } = (await response.json()) as { url: string };

    return new URL(url).searchParams.get("state") ?? "";
  };

  const callback = async (
    state: string,
    { extra = "", providerId = "google" } = {},
  ) =>
    await request(
      `/${providerId}/callback?code=provider-code&state=${state}${extra}`,
    );

  const postJson = async (path: string, body: unknown) =>
    await request(path, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

  /** The confirmation link inside the last email. */
  const lastLink = () => {
    const args = send.mock.lastCall?.[0] as {
      content: (props: unknown) => { props: { actionUrl: string } };
      to: string;
    };

    return new URL(args.content({}).props.actionUrl);
  };
  const lastToken = () => lastLink().searchParams.get("confirm") ?? "";

  return {
    afterSignIn,
    app,
    callback,
    createAccount,
    createAdminSession,
    createSession,
    discord,
    flow,
    google,
    inserts,
    jar,
    lastLink,
    lastToken,
    postJson,
    request,
    requests,
    send,
    signIn: async (extra = "") => await callback(await start(), { extra }),
    start,
    updates,
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const RETURNING = new Map([
  [
    "google:google-alice",
    { email: "alice@example.test", emailVerified: true, userId: 7 },
  ],
]);

describe("signing in through an SSO provider", () => {
  it("still signs a returning member in with a public session only", async () => {
    const h = harness({ linked: RETURNING });

    const response = await h.signIn();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 7 });
    expect(h.createSession).toHaveBeenCalledWith(7);
    expect(h.createAdminSession).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie().join(";")).not.toContain(
      "vitnode_auth_admin",
    );
  });

  it("hands the normalized provider profile to the sign-in sync", async () => {
    const h = harness({ linked: RETURNING });

    await h.signIn();

    expect(h.afterSignIn).toHaveBeenCalledWith({
      identity: {
        email: "alice@example.test",
        id: "google-alice",
        profile: {
          avatarUrl: "https://lh3.googleusercontent.test/a/photo.png",
          firstName: "Alice",
          lastName: "Smith",
        },
        username: "Alice Smith",
      },
      providerId: "google",
      userId: 7,
    });
  });

  it("still confirms an unverified account whose email the provider vouches for", async () => {
    const h = harness({
      linked: new Map([
        [
          "google:google-alice",
          { email: "alice@example.test", emailVerified: false, userId: 7 },
        ],
      ]),
    });

    await h.signIn();

    expect(h.updates).toEqual([{ emailVerified: true }]);
  });

  it("signs a returning member in by their provider id when the email is missing or unverified", async () => {
    for (const user of [
      { ...PROVIDER_USER, email: null, firstName: null, lastName: null },
      { ...PROVIDER_USER, emailVerified: false },
    ]) {
      const h = harness({
        linked: new Map([
          [
            "google:google-alice",
            { email: "alice@example.test", emailVerified: false, userId: 7 },
          ],
        ]),
        user,
      });

      const response = await h.signIn();

      expect(response.status).toBe(200);
      expect(h.createSession).toHaveBeenCalledWith(7);
      // Nothing the provider could not vouch for confirms the stored address.
      expect(h.updates).toEqual([]);
      expect(h.afterSignIn).toHaveBeenCalledWith(
        expect.objectContaining({
          identity: expect.objectContaining({ email: null }),
        }),
      );
      vi.restoreAllMocks();
    }
  });

  it("signs up a new member with the verified email the provider shared", async () => {
    const h = harness();

    const response = await h.signIn();

    expect(response.status).toBe(200);
    expect(h.createAccount).toHaveBeenCalledWith({
      email: "alice@example.test",
      name: "Alice Smith",
    });
    expect(h.inserts).toEqual([
      {
        table: core_users_sso,
        values: {
          providerAccountId: "google-alice",
          providerEmail: "alice@example.test",
          providerId: "google",
          providerUsername: "Alice Smith",
          userId: 100,
        },
      },
    ]);
    expect(h.createSession).toHaveBeenCalledWith(100);
  });

  it("asks for the existing account's password when the verified email is taken", async () => {
    const h = harness({
      accounts: [
        {
          email: "alice@example.test",
          emailVerified: true,
          id: 7,
          password: "hash",
        },
      ],
    });

    const response = await h.signIn();
    const body = (await response.json()) as {
      email: string;
      hasPassword: boolean;
      linkToken: string;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      email: "alice@example.test",
      hasPassword: true,
    });
    expect(
      verifySsoLinkToken({
        providerId: "google",
        secret: LINK_SECRET,
        token: body.linkToken,
      }),
    ).toMatchObject({ providerAccountId: "google-alice", userId: 7 });
    expect(h.createAccount).not.toHaveBeenCalled();
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("retries a taken name with a short suffix instead of failing the sign-up", async () => {
    const h = harness();
    h.createAccount
      .mockRejectedValueOnce(
        new HTTPException(409, { message: "Name already exists" }),
      )
      .mockResolvedValueOnce(100);

    const response = await h.signIn();

    expect(response.status).toBe(200);
    expect(h.createAccount.mock.calls[1]?.[0].name).toMatch(
      /^Alice Smith \d{4}$/,
    );
  });
});

describe("the state of a sign-in round trip", () => {
  it("rejects a callback without the browser's binding cookie", async () => {
    const h = harness({ linked: RETURNING });
    const state = await h.start();
    h.jar.clear();

    const response = await h.callback(state);

    expect(response.status).toBe(400);
    expect(h.google.fetchToken).not.toHaveBeenCalled();
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("rejects a state started in another browser", async () => {
    const h = harness({ linked: RETURNING });
    const state = await h.start();
    h.jar.set(
      "vitnode_auth--sso-binding",
      "another-browser-binding-secret-0123456789abcdefgh",
    );

    expect((await h.callback(state)).status).toBe(400);
    expect(h.google.fetchToken).not.toHaveBeenCalled();
  });

  it("works once", async () => {
    const h = harness({ linked: RETURNING });
    const state = await h.start();

    expect((await h.callback(state)).status).toBe(200);
    expect((await h.callback(state)).status).toBe(400);
    expect(h.google.fetchToken).toHaveBeenCalledTimes(1);
  });

  it("belongs to the provider it was started for", async () => {
    const h = harness({ linked: RETURNING });
    const state = await h.start("google");

    const response = await h.callback(state, { providerId: "discord" });

    expect(response.status).toBe(400);
    expect(h.discord.fetchToken).not.toHaveBeenCalled();
    // Spent anyway: a state cannot be retried against the right provider.
    expect((await h.callback(state)).status).toBe(400);
  });

  it("expires after ten minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const h = harness({ linked: RETURNING });
    const state = await h.start();

    vi.setSystemTime(Date.now() + 10 * 60_000 + 1);

    expect((await h.callback(state)).status).toBe(400);
  });

  it("is a server-side record: the state and verifier never sit in a cookie", async () => {
    const h = harness({ linked: RETURNING });
    const state = await h.start();
    const [attempt] = h.flow.attempts();

    expect(attempt?.stateHash).not.toBe(state);
    expect([...h.jar.values()].join(";")).not.toContain(state);
    expect([...h.jar.values()].join(";")).not.toContain(
      attempt?.codeVerifier ?? "-",
    );
  });

  it("hands the adapter the PKCE verifier behind its challenge, the nonce and the extra callback fields", async () => {
    const h = harness({ linked: RETURNING });
    const user = JSON.stringify({ name: { firstName: "Alice" } });

    await h.signIn(`&user=${encodeURIComponent(user)}`);

    const [request] = h.requests;
    const [code, context] = h.google.fetchToken.mock.calls[0] ?? [];
    expect(code).toBe("provider-code");
    expect(context).toEqual({
      codeVerifier: expect.any(String),
      nonce: request?.nonce,
      params: { user },
    });
    expect(request?.codeChallengeMethod).toBe("S256");
    expect(pkceChallengeS256(String(context?.codeVerifier))).toBe(
      request?.codeChallenge,
    );
    expect(h.google.fetchUser.mock.calls[0]?.[1]).toEqual(context);
  });
});

describe("a new identity without a trustworthy email", () => {
  const NO_EMAIL = { ...PROVIDER_USER, email: null };

  it("waits server-side for a confirmed address instead of creating or linking anything", async () => {
    for (const user of [NO_EMAIL, { ...PROVIDER_USER, emailVerified: false }]) {
      const h = harness({
        // An account with the provider's unverified address must not matter.
        accounts: [
          {
            email: "alice@example.test",
            emailVerified: true,
            id: 7,
            password: "hash",
          },
        ],
        user,
      });

      const response = await h.signIn();

      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({
        email: user.email ?? null,
        emailRequired: true,
      });
      expect(h.flow.pending()).toEqual([
        expect.objectContaining({
          email: null,
          providerAccountId: "google-alice",
          providerId: "google",
        }),
      ]);
      expect(h.jar.get("vitnode_auth--sso-pending")).toMatch(/^[\w-]{43}$/);
      expect(h.createAccount).not.toHaveBeenCalled();
      expect(h.inserts).toEqual([]);
      expect(h.createSession).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  });

  it("refuses when this install cannot send a confirmation email", async () => {
    const h = harness({ emailAdapter: false, user: NO_EMAIL });

    const response = await h.signIn();

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "email_unavailable" });
    expect(h.flow.pending()).toEqual([]);
  });
});

describe("confirming an email for a provider that shared none", () => {
  const pendingHarness = async (accounts: Account[] = []) => {
    const h = harness({ accounts, user: { ...PROVIDER_USER, email: null } });
    expect((await h.signIn()).status).toBe(202);

    return h;
  };

  it("emails a confirmation link for this provider to the typed address", async () => {
    const h = await pendingHarness();

    const response = await h.postJson("/pending/google/email", {
      email: "Alice@Mail.test",
    });

    expect(response.status).toBe(201);
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en", to: "alice@mail.test" }),
    );
    const link = h.lastLink();
    expect(`${link.origin}${link.pathname}`).toBe(
      "http://localhost:3000/login/sso/google",
    );
    expect(h.lastToken()).toMatch(/^[\w-]{43}$/);
    expect(await response.text()).toBe("");
    // Only a hash of the link's token is kept.
    expect(JSON.stringify(h.flow.pending())).not.toContain(h.lastToken());
  });

  it("needs the pending sign-in of this browser and this provider", async () => {
    const h = await pendingHarness();

    const otherProvider = await h.postJson("/pending/discord/email", {
      email: "alice@mail.test",
    });
    h.jar.delete("vitnode_auth--sso-pending");
    const noCookie = await h.postJson("/pending/google/email", {
      email: "alice@mail.test",
    });

    expect(otherProvider.status).toBe(400);
    expect(noCookie.status).toBe(400);
    expect(await noCookie.json()).toEqual({ error: "invalid_pending" });
    expect(h.send).not.toHaveBeenCalled();
  });

  it("creates a verified account with the confirmed address, once", async () => {
    const h = await pendingHarness();
    await h.postJson("/pending/google/email", { email: "alice@mail.test" });
    const token = h.lastToken();

    const response = await h.postJson("/pending/google/confirm", { token });

    expect(response.status).toBe(200);
    expect(h.createAccount).toHaveBeenCalledWith({
      email: "alice@mail.test",
      name: "Alice Smith",
    });
    expect(h.inserts).toEqual([
      expect.objectContaining({
        values: expect.objectContaining({
          providerAccountId: "google-alice",
          providerEmail: null,
        }),
      }),
    ]);
    expect(h.createSession).toHaveBeenCalledWith(100);
    expect(h.flow.pending()).toEqual([]);
    const replay = await h.postJson("/pending/google/confirm", { token });
    expect(replay.status).toBe(400);
  });

  it("works only in the browser that started the sign-in", async () => {
    const h = await pendingHarness();
    await h.postJson("/pending/google/email", { email: "alice@mail.test" });
    h.jar.delete("vitnode_auth--sso-pending");

    const response = await h.postJson("/pending/google/confirm", {
      token: h.lastToken(),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_pending" });
    expect(h.createAccount).not.toHaveBeenCalled();
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("asks for the existing account's password when the confirmed address has one", async () => {
    const h = await pendingHarness([
      {
        email: "alice@mail.test",
        emailVerified: true,
        id: 7,
        password: "hash",
      },
    ]);
    await h.postJson("/pending/google/email", { email: "alice@mail.test" });

    const response = await h.postJson("/pending/google/confirm", {
      token: h.lastToken(),
    });
    const body = (await response.json()) as { linkToken: string };

    expect(response.status).toBe(409);
    expect(
      verifySsoLinkToken({
        providerId: "google",
        secret: LINK_SECRET,
        token: body.linkToken,
      }),
    ).toEqual({
      email: "alice@mail.test",
      providerAccountId: "google-alice",
      providerEmail: null,
      providerId: "google",
      userId: 7,
    });
    expect(h.createAccount).not.toHaveBeenCalled();
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("refuses a made-up token, and keeps the sign-in waiting for the real link", async () => {
    const h = await pendingHarness();
    await h.postJson("/pending/google/email", { email: "alice@mail.test" });

    const forged = await h.postJson("/pending/google/confirm", {
      token: "a".repeat(43),
    });

    expect(forged.status).toBe(400);
    expect(await forged.json()).toEqual({ error: "invalid_link" });
    expect(
      (await h.postJson("/pending/google/confirm", { token: h.lastToken() }))
        .status,
    ).toBe(200);
  });

  it("lets the link expire after thirty minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const h = await pendingHarness();
    await h.postJson("/pending/google/email", { email: "alice@mail.test" });

    vi.setSystemTime(Date.now() + 30 * 60_000 + 1);
    const late = await h.postJson("/pending/google/confirm", {
      token: h.lastToken(),
    });

    expect(late.status).toBe(400);
    expect(h.createAccount).not.toHaveBeenCalled();
  });

  it("spaces out new links and replaces the previous one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const h = await pendingHarness();
    await h.postJson("/pending/google/email", { email: "alice@mail.test" });
    const first = h.lastToken();

    const tooSoon = await h.postJson("/pending/google/email", {
      email: "alice@mail.test",
    });
    expect(tooSoon.status).toBe(429);
    expect(await tooSoon.json()).toEqual({ error: "too_many_emails" });

    vi.setSystemTime(Date.now() + 30_000);
    expect(
      (await h.postJson("/pending/google/email", { email: "alice@mail.test" }))
        .status,
    ).toBe(201);

    const stale = await h.postJson("/pending/google/confirm", { token: first });
    expect(await stale.json()).toEqual({ error: "invalid_link" });
    expect(
      (await h.postJson("/pending/google/confirm", { token: h.lastToken() }))
        .status,
    ).toBe(200);
  });
});
