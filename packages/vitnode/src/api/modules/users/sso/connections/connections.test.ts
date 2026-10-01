// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  EnvVariablesVitNode,
  EnvVitNode,
} from "@/api/middlewares/global.middleware";
import type { SSOApiPlugin, SSOProviderUser } from "@/api/models/sso";
import type { SsoProfilePolicy } from "@/api/models/sso-connection";

import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import {
  SSO_CONNECTION_STATE_TTL_MS,
  SsoConnectionModel,
  ssoIdentityOf,
} from "@/api/models/sso-connection";
import {
  createMemorySsoConnectionStore,
  type MemorySsoAccount,
} from "@/tests/sso-connection-store";

import { ssoConnectionsModule } from "./connections.module";

type Authorization = EnvVariablesVitNode["core"]["authorization"];

const account = (
  id: number,
  overrides: Partial<MemorySsoAccount> = {},
): MemorySsoAccount => ({
  avatarId: null,
  email: `user${id}@vitnode.test`,
  firstName: null,
  hasPassword: true,
  id,
  lastName: null,
  name: `User${id}`,
  passkeys: 0,
  roleId: 2,
  showRealName: false,
  ...overrides,
});

const ALICE = account(1, { firstName: "Alicja", lastName: "Kowalska" });
const BOB = account(2);

const provider = (
  id: string,
  name: string,
  profileFields: SSOApiPlugin["profileFields"],
  users: Map<string, SSOProviderUser>,
): SSOApiPlugin & {
  fetchToken: ReturnType<typeof vi.fn>;
  fetchUser: ReturnType<typeof vi.fn>;
} => ({
  fetchToken: vi.fn(async (code: string) =>
    Promise.resolve({ access_token: code, token_type: "Bearer" }),
  ),
  fetchUser: vi.fn(async ({ access_token }: { access_token: string }) => {
    const user = users.get(access_token);
    if (!user) throw new Error("unknown code");

    return Promise.resolve(user);
  }),
  getUrl: ({ state }) =>
    `https://${id}.example/oauth?state=${encodeURIComponent(state)}`,
  id,
  name,
  profileFields,
});

const OPEN_POLICY: SsoProfilePolicy = {
  avatar: { allowed: true, maxBytes: 1024 * 1024 },
  firstName: true,
  lastName: true,
};

const json = (body: unknown, method = "POST"): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method,
});

const harness = ({
  accounts = [ALICE, BOB],
  passkeysEnabled = false,
  passwordEnabled = true,
}: {
  accounts?: MemorySsoAccount[];
  passkeysEnabled?: boolean;
  passwordEnabled?: boolean;
} = {}) => {
  const memory = createMemorySsoConnectionStore(accounts);
  const profiles = new Map<string, SSOProviderUser>();
  const google = provider(
    "google",
    "Google",
    ["avatar", "firstName", "lastName"],
    profiles,
  );
  const discord = provider("discord", "Discord", ["avatar"], profiles);
  let adapters: SSOApiPlugin[] = [google, discord];
  let policy = OPEN_POLICY;

  vi.spyOn(SsoConnectionModel.prototype, "store", "get").mockReturnValue(
    memory.store,
  );
  vi.spyOn(SsoConnectionModel.prototype, "profilePolicy").mockImplementation(
    async () => Promise.resolve(policy),
  );
  vi.spyOn(SsoConnectionModel.prototype, "refreshSessions").mockResolvedValue(
    undefined,
  );
  const importAvatar = vi
    .spyOn(SsoConnectionModel.prototype, "importAvatar")
    .mockImplementation(async ({ url }) =>
      Promise.resolve({
        fileId: 500,
        sha256: "a".repeat(64),
        sourceUrl: url,
        status: "updated" as const,
      }),
    );
  const createSession = vi
    .spyOn(SessionModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "session-token" });
  const createAdminSession = vi
    .spyOn(SessionAdminModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "admin-token" });
  const emit = vi.fn(async () => Promise.resolve(undefined));

  const authorization = (): Authorization => ({
    adminCookieExpires: 1000 * 60 * 60 * 24,
    adminCookieName: "vitnode_auth_admin",
    cookieDomain: undefined,
    cookie_expires: 1000 * 60 * 60 * 24 * 90,
    cookieName: "vitnode_auth",
    cookieSecure: true,
    deviceCookieExpires: 1000 * 60 * 60 * 24 * 365,
    deviceCookieName: "vitnode_device",
    passkeys: passkeysEnabled
      ? {
          enabled: true,
          origins: ["https://vitnode.test"],
          rpId: "vitnode.test",
          rpName: "VitNode",
        }
      : { enabled: false, problems: [] },
    password: { enabled: passwordEnabled },
    ssoAdapters: adapters,
  });

  let viewer: MemorySsoAccount | null = null;
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: authorization(),
    } as EnvVariablesVitNode["core"]);
    c.set("user", viewer as unknown as Context["var"]["user"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    await next();
  });
  app.route("/", ssoConnectionsModule.hono);

  const setCookies: string[] = [];
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await app.request(path, init);
    setCookies.push(...response.headers.getSetCookie());

    return response;
  };

  const context = () =>
    ({
      get: (key: string) =>
        ({
          core: { authorization: authorization() },
          events: { emit },
        })[key],
    }) as unknown as Context<EnvVitNode>;

  const startRoundTrip = async (
    providerId: string,
    body: { fields?: string[]; intent: "import" | "link" | "sync" },
  ) => {
    const response = await request(`/${providerId}/authorize`, json(body));
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };

    return new URL(url).searchParams.get("state") ?? "";
  };

  const finish = async (providerId: string, code: string, state: string) =>
    await request(`/${providerId}/callback`, json({ code, state }));

  return {
    ...memory,
    context,
    createAdminSession,
    createSession,
    discord,
    emit,
    finish,
    google,
    importAvatar,
    profiles,
    request,
    setAdapters: (next: SSOApiPlugin[]) => {
      adapters = next;
    },
    setCookies,
    setPolicy: (next: SsoProfilePolicy) => {
      policy = next;
    },
    signInAs: (user: MemorySsoAccount | null) => {
      viewer = user;
    },
    startRoundTrip,
  };
};

type Harness = ReturnType<typeof harness>;

const connectGoogle = async (
  h: Harness,
  profile: Partial<SSOProviderUser> = {},
) => {
  h.profiles.set("code-google", {
    email: "alice.personal@gmail.test",
    id: "google-alice",
    username: "Alice Personal",
    ...profile,
  });
  const state = await h.startRoundTrip("google", { intent: "link" });

  return await h.finish("google", "code-google", state);
};

const errorOf = async (response: Response) =>
  ((await response.json()) as { error: string }).error;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("connecting an account from settings", () => {
  it("links the provider account to the signed-in user even when its email differs", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await connectGoogle(h);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intent: "link",
      providerId: "google",
    });
    expect(h.connections).toEqual([
      expect.objectContaining({
        providerAccountId: "google-alice",
        providerEmail: "alice.personal@gmail.test",
        providerId: "google",
        syncOnSignIn: false,
        userId: ALICE.id,
      }),
    ]);
    expect(h.users.get(ALICE.id)?.email).toBe(ALICE.email);
    expect(h.emit).toHaveBeenCalledWith("user.sso.linked", {
      email: ALICE.email,
      providerId: "google",
      userId: ALICE.id,
    });
  });

  it("never signs anybody in, and never opens an AdminCP session", async () => {
    const h = harness();
    h.signInAs(ALICE);

    await connectGoogle(h);

    expect(h.createSession).not.toHaveBeenCalled();
    expect(h.createAdminSession).not.toHaveBeenCalled();
    expect(h.setCookies.join(";")).not.toContain("vitnode_auth_admin");
  });

  it("does not copy anything onto the profile just because an account was connected", async () => {
    const h = harness();
    h.signInAs(ALICE);

    await connectGoogle(h, {
      avatarUrl: "https://lh3.googleusercontent.test/a/photo.png",
      firstName: "Somebody",
      lastName: "Else",
    });

    expect(h.users.get(ALICE.id)).toMatchObject({
      avatarId: null,
      firstName: "Alicja",
      lastName: "Kowalska",
    });
    expect(h.importAvatar).not.toHaveBeenCalled();
    expect(h.sources).toEqual([]);
  });

  it("refuses a provider account that already belongs to another member", async () => {
    const h = harness();
    h.connect(BOB.id, "google", "google-alice");
    h.signInAs(ALICE);

    const response = await connectGoogle(h);

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("account_taken");
    expect(h.connections).toEqual([
      expect.objectContaining({ userId: BOB.id }),
    ]);
  });

  it("allows one account per provider", async () => {
    const h = harness();
    h.connect(ALICE.id, "google", "google-work");
    h.signInAs(ALICE);

    const response = await h.request(
      "/google/authorize",
      json({ intent: "link" }),
    );

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("provider_already_connected");
  });

  it("refuses a second account that raced in after the round trip started", async () => {
    const h = harness();
    h.signInAs(ALICE);
    h.profiles.set("code-google", {
      email: "a@gmail.test",
      id: "google-alice",
      username: "A",
    });
    const state = await h.startRoundTrip("google", { intent: "link" });
    h.connect(ALICE.id, "google", "google-other");

    const response = await h.finish("google", "code-google", state);

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("provider_already_connected");
  });

  it("answers 404 for a provider this site does not configure", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await h.request(
      "/github/authorize",
      json({ intent: "link" }),
    );

    expect(response.status).toBe(404);
  });
});

describe("the state of a settings round trip", () => {
  const prepare = async () => {
    const h = harness();
    h.signInAs(ALICE);
    h.profiles.set("code-google", {
      email: "a@gmail.test",
      id: "google-alice",
      username: "A",
    });
    const state = await h.startRoundTrip("google", { intent: "link" });

    return { h, state };
  };

  it("is stored hashed, never as the value in the URL", async () => {
    const { h, state } = await prepare();

    expect(h.operations()).toHaveLength(1);
    expect(h.operations()[0]?.tokenHash).not.toBe(state);
    expect(h.operations()[0]?.tokenHash).toMatch(/^[\da-f]{64}$/);
  });

  it("rejects a state the server never issued, before talking to the provider", async () => {
    const { h } = await prepare();

    const response = await h.finish(
      "google",
      "code-google",
      `cl_${"f".repeat(64)}`,
    );

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("invalid_state");
    expect(h.google.fetchToken).not.toHaveBeenCalled();
  });

  it("rejects the public sign-in state", async () => {
    const { h } = await prepare();

    const response = await h.finish(
      "google",
      "code-google",
      "0123456789abcdef",
    );

    expect(response.status).toBe(400);
    expect(h.connections).toEqual([]);
  });

  it("expires after ten minutes", async () => {
    const { h, state } = await prepare();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + SSO_CONNECTION_STATE_TTL_MS + 1000);

    const response = await h.finish("google", "code-google", state);

    expect(response.status).toBe(400);
    expect(h.connections).toEqual([]);
  });

  it("works once", async () => {
    const { h, state } = await prepare();

    expect((await h.finish("google", "code-google", state)).status).toBe(200);
    const replay = await h.finish("google", "code-google", state);

    expect(replay.status).toBe(400);
    expect(await errorOf(replay)).toBe("invalid_state");
  });

  it("belongs to the provider it was issued for", async () => {
    const { h, state } = await prepare();

    const response = await h.finish("discord", "code-google", state);

    expect(response.status).toBe(400);
    expect(h.connections).toEqual([]);
  });

  it("belongs to the intent it was issued for", async () => {
    const { h, state } = await prepare();
    h.connect(ALICE.id, "discord", "discord-alice");
    const importState = await h.startRoundTrip("discord", {
      fields: ["avatar"],
      intent: "import",
    });

    const asLink = await h.finish(
      "discord",
      "code-google",
      importState.replace(/^ci_/, "cl_"),
    );

    expect(asLink.status).toBe(400);
    expect(state).toMatch(/^cl_/);
  });

  it("belongs to the member who started it, and is spent by a stranger's attempt", async () => {
    const { h, state } = await prepare();
    h.signInAs(BOB);

    const stolen = await h.finish("google", "code-google", state);

    expect(stolen.status).toBe(400);
    expect(h.connections).toEqual([]);

    h.signInAs(ALICE);
    expect((await h.finish("google", "code-google", state)).status).toBe(400);
  });

  it("needs a signed-in member at both ends", async () => {
    const { h, state } = await prepare();
    h.signInAs(null);

    expect((await h.finish("google", "code-google", state)).status).toBe(401);
    expect(
      (await h.request("/google/authorize", json({ intent: "link" }))).status,
    ).toBe(401);
    expect((await h.request("/")).status).toBe(401);
    expect((await h.request("/google", { method: "DELETE" })).status).toBe(401);
    expect(
      (await h.request("/preferences", json({ sources: {}, sync: {} }, "PUT")))
        .status,
    ).toBe(401);
  });
});

describe("disconnecting an account", () => {
  it("removes the connection and its sync settings, and nothing at the provider", async () => {
    const h = harness();
    h.connect(ALICE.id, "google", "google-alice");
    h.sources.push({ field: "avatar", providerId: "google", userId: ALICE.id });
    h.signInAs(ALICE);

    const response = await h.request("/google", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(h.connections).toEqual([]);
    expect(h.sources).toEqual([]);
    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
    expect(h.google.fetchToken).not.toHaveBeenCalled();
    expect(h.emit).toHaveBeenCalledWith("user.sso.unlinked", {
      providerId: "google",
      userId: ALICE.id,
    });
  });

  it("only ever touches the signed-in member's own connection", async () => {
    const h = harness();
    h.connect(ALICE.id, "google", "google-alice");
    h.signInAs(BOB);

    const response = await h.request("/google", { method: "DELETE" });

    expect(response.status).toBe(404);
    expect(h.connections).toHaveLength(1);
  });

  it.each([
    {
      expected: 200,
      name: "a password, with password sign-in on",
      setup: { hasPassword: true, passkeys: 0 },
      toggles: { passkeysEnabled: false, passwordEnabled: true },
    },
    {
      expected: 409,
      name: "a password, with password sign-in off",
      setup: { hasPassword: true, passkeys: 0 },
      toggles: { passkeysEnabled: false, passwordEnabled: false },
    },
    {
      expected: 200,
      name: "a passkey, with passkeys on",
      setup: { hasPassword: false, passkeys: 1 },
      toggles: { passkeysEnabled: true, passwordEnabled: true },
    },
    {
      expected: 409,
      name: "a passkey, with passkeys off",
      setup: { hasPassword: false, passkeys: 1 },
      toggles: { passkeysEnabled: false, passwordEnabled: true },
    },
    {
      expected: 409,
      name: "nothing else at all",
      setup: { hasPassword: false, passkeys: 0 },
      toggles: { passkeysEnabled: true, passwordEnabled: true },
    },
  ])("with $name, answers $expected", async ({ expected, setup, toggles }) => {
    const h = harness({
      accounts: [account(1, setup)],
      ...toggles,
    });
    h.connect(1, "google", "google-1");
    h.signInAs(account(1, setup));

    const response = await h.request("/google", { method: "DELETE" });

    expect(response.status).toBe(expected);
    if (expected === 409) {
      expect(await errorOf(response)).toBe("last_sign_in_method");
      expect(h.connections).toHaveLength(1);
    }
  });

  it("counts another connection only while its provider is still configured", async () => {
    const lonely = account(1, { hasPassword: false });
    const h = harness({ accounts: [lonely] });
    h.connect(1, "google", "google-1");
    h.connect(1, "discord", "discord-1");
    h.signInAs(lonely);
    h.setAdapters([h.google]);

    expect((await h.request("/google", { method: "DELETE" })).status).toBe(409);

    h.setAdapters([h.google, h.discord]);
    expect((await h.request("/google", { method: "DELETE" })).status).toBe(200);
  });

  it("keeps one way in when two disconnects race each other", async () => {
    const lonely = account(1, { hasPassword: false });
    const h = harness({ accounts: [lonely] });
    h.connect(1, "google", "google-1");
    h.connect(1, "discord", "discord-1");
    h.signInAs(lonely);

    const statuses = (
      await Promise.all([
        h.request("/google", { method: "DELETE" }),
        h.request("/discord", { method: "DELETE" }),
      ])
    ).map(response => response.status);

    expect(statuses.toSorted((a, b) => a - b)).toEqual([200, 409]);
    expect(h.connections).toHaveLength(1);
  });
});

describe("choosing where profile fields come from", () => {
  const withBoth = () => {
    const h = harness();
    h.connect(ALICE.id, "google", "google-alice");
    h.connect(ALICE.id, "discord", "discord-alice");
    h.signInAs(ALICE);

    return h;
  };

  const save = async (h: Harness, body: unknown) =>
    await h.request("/preferences", json(body, "PUT"));

  it("keeps a single provider per field", async () => {
    const h = withBoth();

    await save(h, { sources: { avatar: "google" }, sync: {} });
    const response = await save(h, {
      sources: { avatar: "discord", firstName: "google" },
      sync: { discord: true },
    });

    expect(response.status).toBe(200);
    expect(
      h.sources.toSorted((a, b) => a.field.localeCompare(b.field)),
    ).toEqual([
      { field: "avatar", providerId: "discord", userId: ALICE.id },
      { field: "firstName", providerId: "google", userId: ALICE.id },
    ]);
    expect(
      h.connections.find(one => one.providerId === "discord")?.syncOnSignIn,
    ).toBe(true);
  });

  it("puts a field back to manual with null", async () => {
    const h = withBoth();
    await save(h, { sources: { avatar: "google" }, sync: {} });

    await save(h, { sources: { avatar: null }, sync: {} });

    expect(h.sources).toEqual([]);
  });

  it("refuses a provider that cannot supply the field", async () => {
    const h = withBoth();

    const response = await save(h, {
      sources: { firstName: "discord" },
      sync: {},
    });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("invalid_source");
    expect(h.sources).toEqual([]);
  });

  it("refuses a provider the member has not connected", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const sources = await save(h, { sources: { avatar: "google" }, sync: {} });
    const sync = await save(h, { sources: {}, sync: { google: true } });

    expect(sources.status).toBe(400);
    expect(sync.status).toBe(400);
  });

  it("starts every connection manual, with sign-in updates off", async () => {
    const h = withBoth();

    const response = await h.request("/");
    const body = (await response.json()) as {
      providers: {
        connection: null | { syncOnSignIn: boolean };
        id: string;
        profileFields: string[];
      }[];
      sources: Record<string, null | string>;
    };

    expect(body.sources).toEqual({
      avatar: null,
      firstName: null,
      lastName: null,
    });
    expect(
      body.providers.map(one => [
        one.id,
        one.connection?.syncOnSignIn,
        one.profileFields,
      ]),
    ).toEqual([
      ["google", false, ["avatar", "firstName", "lastName"]],
      ["discord", false, ["avatar"]],
    ]);
  });
});

describe("importing a profile now", () => {
  const importFrom = async (
    h: Harness,
    fields: string[],
    profile: Partial<SSOProviderUser> = {},
  ) => {
    h.profiles.set("code-import", {
      avatarUrl: "https://lh3.googleusercontent.test/a/new.png",
      email: "alice.personal@gmail.test",
      firstName: "Alice",
      id: "google-alice",
      lastName: "Smith",
      username: "Alice Smith",
      ...profile,
    });
    const state = await h.startRoundTrip("google", {
      fields,
      intent: "import",
    });

    return await h.finish("google", "code-import", state);
  };

  const prepare = (overrides: Partial<MemorySsoAccount> = {}) => {
    const alice = { ...ALICE, ...overrides };
    const h = harness({ accounts: [alice, BOB] });
    h.connect(ALICE.id, "google", "google-alice");
    h.signInAs(alice);

    return h;
  };

  it("shows a preview first and changes nothing until the member confirms", async () => {
    const h = prepare();

    const callback = await importFrom(h, ["firstName", "lastName"]);
    expect(callback.status).toBe(200);
    expect(await callback.json()).toEqual({
      intent: "import",
      providerId: "google",
    });

    const preview = await h.request("/google/import");
    expect(preview.status).toBe(200);
    expect(((await preview.json()) as { fields: unknown[] }).fields).toEqual([
      expect.objectContaining({
        current: "Alicja",
        field: "firstName",
        incoming: "Alice",
      }),
      expect.objectContaining({
        current: "Kowalska",
        field: "lastName",
        incoming: "Smith",
      }),
    ]);
    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
  });

  it("applies only the confirmed fields, once, and leaves showRealName alone", async () => {
    const h = prepare({ showRealName: false });
    await importFrom(h, ["firstName", "lastName"]);

    const response = await h.request(
      "/google/import",
      json({ fields: ["firstName"] }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      manualFields: [],
      results: { firstName: "updated" },
    });
    expect(h.users.get(ALICE.id)).toMatchObject({
      firstName: "Alice",
      lastName: "Kowalska",
      showRealName: false,
    });
    expect(h.emit).toHaveBeenCalledWith("user.sso.profile_synced", {
      fields: ["firstName"],
      providerId: "google",
      trigger: "import",
      userId: ALICE.id,
    });

    const replay = await h.request(
      "/google/import",
      json({ fields: ["firstName"] }),
    );
    expect(replay.status).toBe(404);
  });

  it("keeps local values the provider did not send", async () => {
    const h = prepare();
    await importFrom(h, ["firstName", "lastName"], {
      firstName: "   ",
      lastName: undefined,
    });

    const response = await h.request(
      "/google/import",
      json({ fields: ["firstName", "lastName"] }),
    );

    expect(await response.json()).toEqual({
      manualFields: [],
      results: { firstName: "missing", lastName: "missing" },
    });
    expect(h.users.get(ALICE.id)).toMatchObject({
      firstName: "Alicja",
      lastName: "Kowalska",
    });
  });

  it("respects a role that may not edit personal information", async () => {
    const h = prepare();
    h.setPolicy({ ...OPEN_POLICY, firstName: false, lastName: false });
    await importFrom(h, ["firstName"]);

    const response = await h.request(
      "/google/import",
      json({ fields: ["firstName"] }),
    );

    expect(await response.json()).toMatchObject({
      results: { firstName: "not_allowed" },
    });
    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
  });

  it("refuses fields that were not part of the round trip", async () => {
    const h = prepare();
    await importFrom(h, ["firstName"]);

    const response = await h.request(
      "/google/import",
      json({ fields: ["lastName"] }),
    );

    expect(response.status).toBe(400);
    expect(h.users.get(ALICE.id)?.lastName).toBe("Kowalska");
  });

  it("refuses fields the provider cannot supply at all", async () => {
    const h = harness();
    h.connect(ALICE.id, "discord", "discord-alice");
    h.signInAs(ALICE);

    const response = await h.request(
      "/discord/authorize",
      json({ fields: ["firstName"], intent: "import" }),
    );

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("invalid_fields");
  });

  it("needs the provider to be connected first", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await h.request(
      "/google/authorize",
      json({ fields: ["avatar"], intent: "import" }),
    );

    expect(response.status).toBe(404);
  });

  it("refuses a different account at the provider", async () => {
    const h = prepare();

    const response = await importFrom(h, ["firstName"], { id: "google-bob" });

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("account_mismatch");
    expect((await h.request("/google/import")).status).toBe(404);
  });

  it("keeps the current avatar when the download fails", async () => {
    const h = prepare({ avatarId: 42 });
    h.importAvatar.mockRejectedValueOnce(new Error("blocked_address"));
    await importFrom(h, ["avatar"]);

    const response = await h.request(
      "/google/import",
      json({ fields: ["avatar"] }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      results: { avatar: "failed" },
    });
    expect(h.users.get(ALICE.id)?.avatarId).toBe(42);
  });

  it("switches a field synced from another provider to manual", async () => {
    const h = prepare();
    h.connect(ALICE.id, "discord", "discord-alice");
    h.sources.push({
      field: "avatar",
      providerId: "discord",
      userId: ALICE.id,
    });
    await importFrom(h, ["avatar"]);

    const response = await h.request(
      "/google/import",
      json({ fields: ["avatar"] }),
    );

    expect(await response.json()).toEqual({
      manualFields: ["avatar"],
      results: { avatar: "updated" },
    });
    expect(h.sources).toEqual([]);
  });
});

describe("updating the profile on sign-in", () => {
  const signIn = async (h: Harness, profile: Partial<SSOProviderUser>) => {
    const adapter = h.google;
    const user: SSOProviderUser = {
      email: "Alice.Personal@gmail.test",
      id: "google-alice",
      username: "Alice Smith",
      ...profile,
    };

    await new SsoConnectionModel(h.context()).afterSignIn({
      identity: ssoIdentityOf(adapter, user),
      providerId: "google",
      userId: ALICE.id,
    });
  };

  const prepare = ({ sync }: { sync: boolean }) => {
    const h = harness();
    h.connect(ALICE.id, "google", "google-alice", { syncOnSignIn: sync });
    h.sources.push(
      { field: "firstName", providerId: "google", userId: ALICE.id },
      { field: "avatar", providerId: "google", userId: ALICE.id },
    );

    return h;
  };

  it("changes nothing while sign-in updates are off", async () => {
    const h = prepare({ sync: false });

    await signIn(h, { firstName: "Alice", lastName: "Smith" });

    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
    expect(h.importAvatar).not.toHaveBeenCalled();
  });

  it("updates only the fields sourced from this provider", async () => {
    const h = prepare({ sync: true });

    await signIn(h, {
      avatarUrl: "https://lh3.googleusercontent.test/a/new.png",
      firstName: "Alice",
      lastName: "Smith",
    });

    expect(h.users.get(ALICE.id)).toMatchObject({
      avatarId: 500,
      firstName: "Alice",
      lastName: "Kowalska",
      showRealName: false,
    });
    expect(h.emit).toHaveBeenCalledWith("user.sso.profile_synced", {
      fields: ["avatar", "firstName"],
      providerId: "google",
      trigger: "sign_in",
      userId: ALICE.id,
    });
  });

  it("stops updating a field the member edited by hand", async () => {
    const h = prepare({ sync: true });

    await new SsoConnectionModel(h.context()).clearSourcesAfterManualEdit({
      fields: ["firstName"],
      userId: ALICE.id,
    });
    await signIn(h, { firstName: "Alice" });

    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
    expect(h.sources).toEqual([
      { field: "avatar", providerId: "google", userId: ALICE.id },
    ]);
  });

  it("never erases a value the provider left out", async () => {
    const h = prepare({ sync: true });

    await signIn(h, { firstName: "" });

    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
    expect(h.importAvatar).not.toHaveBeenCalled();
  });

  it("finishes the sign-in even when the avatar cannot be fetched", async () => {
    const h = prepare({ sync: true });
    h.importAvatar.mockRejectedValueOnce(new Error("timeout"));

    await expect(
      signIn(h, {
        avatarUrl: "https://lh3.googleusercontent.test/a/new.png",
        firstName: "Alice",
      }),
    ).resolves.toBeUndefined();

    expect(h.users.get(ALICE.id)).toMatchObject({
      avatarId: null,
      firstName: "Alice",
    });
  });

  it("refreshes the provider email as connection info only", async () => {
    const h = prepare({ sync: false });

    await signIn(h, {});

    expect(h.connections[0]?.providerEmail).toBe("alice.personal@gmail.test");
    expect(h.users.get(ALICE.id)?.email).toBe(ALICE.email);
  });
});

describe("syncing now, without signing out", () => {
  const prepare = () => {
    const h = harness();
    h.connect(ALICE.id, "google", "google-alice");
    h.sources.push(
      { field: "firstName", providerId: "google", userId: ALICE.id },
      { field: "avatar", providerId: "google", userId: ALICE.id },
    );
    h.signInAs(ALICE);

    return h;
  };

  const syncFrom = async (h: Harness, profile: Partial<SSOProviderUser>) => {
    h.profiles.set("code-sync", {
      email: "alice.personal@gmail.test",
      id: "google-alice",
      username: "Alice Smith",
      ...profile,
    });
    const state = await h.startRoundTrip("google", { intent: "sync" });

    return await h.finish("google", "code-sync", state);
  };

  it("re-authenticates and updates the fields sourced from this provider", async () => {
    const h = prepare();

    const response = await syncFrom(h, {
      avatarUrl: "https://lh3.googleusercontent.test/a/new.png",
      firstName: "Alice",
      lastName: "Smith",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intent: "sync",
      providerId: "google",
      results: { avatar: "updated", firstName: "updated" },
    });
    expect(h.users.get(ALICE.id)).toMatchObject({
      avatarId: 500,
      firstName: "Alice",
      lastName: "Kowalska",
      showRealName: false,
    });
    expect(h.emit).toHaveBeenCalledWith("user.sso.profile_synced", {
      fields: ["avatar", "firstName"],
      providerId: "google",
      trigger: "sync",
      userId: ALICE.id,
    });
  });

  it("works while sign-in updates are off, and never touches the session", async () => {
    const h = prepare();

    await syncFrom(h, { firstName: "Alice" });

    expect(h.connections[0]?.syncOnSignIn).toBe(false);
    expect(h.users.get(ALICE.id)?.firstName).toBe("Alice");
    expect(h.createSession).not.toHaveBeenCalled();
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("has nothing to do until a field is sourced from the provider", async () => {
    const h = harness();
    h.connect(ALICE.id, "google", "google-alice");
    h.signInAs(ALICE);

    const response = await h.request(
      "/google/authorize",
      json({ intent: "sync" }),
    );

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe("nothing_to_sync");
  });

  it("ignores field choices sent by the browser", async () => {
    const h = prepare();
    h.profiles.set("code-sync", {
      email: "a@gmail.test",
      firstName: "Alice",
      id: "google-alice",
      lastName: "Smith",
      username: "A",
    });
    const state = await h.startRoundTrip("google", {
      fields: ["lastName"],
      intent: "sync",
    });

    await h.finish("google", "code-sync", state);

    expect(h.users.get(ALICE.id)).toMatchObject({
      firstName: "Alice",
      lastName: "Kowalska",
    });
  });

  it("leaves a field alone if it was switched to manual meanwhile", async () => {
    const h = prepare();
    h.profiles.set("code-sync", {
      email: "a@gmail.test",
      firstName: "Alice",
      id: "google-alice",
      username: "A",
    });
    const state = await h.startRoundTrip("google", { intent: "sync" });
    await new SsoConnectionModel(h.context()).clearSourcesAfterManualEdit({
      fields: ["firstName"],
      userId: ALICE.id,
    });

    const response = await h.finish("google", "code-sync", state);

    expect(await response.json()).toMatchObject({
      results: { avatar: "missing" },
    });
    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
  });

  it("keeps local values the provider did not send", async () => {
    const h = prepare();

    const response = await syncFrom(h, { firstName: " " });

    expect(await response.json()).toMatchObject({
      results: { avatar: "missing", firstName: "missing" },
    });
    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
  });

  it("refuses a different account at the provider", async () => {
    const h = prepare();

    const response = await syncFrom(h, { firstName: "Bob", id: "google-bob" });

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("account_mismatch");
    expect(h.users.get(ALICE.id)?.firstName).toBe("Alicja");
  });
});
