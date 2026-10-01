// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { PasskeyModel } from "@/api/models/passkey";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { core_admin_permissions } from "@/database/admins";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createMemoryDb } from "@/tests/memory-db";
import {
  createMemoryPasskeyStore,
  type MemoryPasskeyAccount,
} from "@/tests/passkey-store";
import {
  type CeremonyOverrides,
  createSoftwareAuthenticator,
} from "@/tests/webauthn";

import { passkeysUserModule } from "./passkeys.module";

const ORIGIN = "https://community.example.com";
const RP_ID = "example.com";

type Authorization = EnvVariablesVitNode["core"]["authorization"];

const GITHUB: Authorization["ssoAdapters"][number] = {
  fetchToken: vi.fn(),
  fetchUser: vi.fn(),
  getUrl: () => "https://github.com/login/oauth/authorize",
  id: "github",
  name: "GitHub",
};

const AUTHORIZATION: Authorization = {
  adminCookieExpires: 1000 * 60 * 60 * 24,
  adminCookieName: "vitnode_auth_admin",
  cookieDomain: undefined,
  cookie_expires: 1000 * 60 * 60 * 24 * 90,
  cookieName: "vitnode_auth",
  cookieSecure: true,
  deviceCookieExpires: 1000 * 60 * 60 * 24 * 365,
  deviceCookieName: "vitnode_device",
  passkeys: {
    enabled: true,
    origins: [ORIGIN],
    rpId: RP_ID,
    rpName: "VitNode",
  },
  password: { enabled: true },
  ssoAdapters: [GITHUB],
};

const ALICE = { email: "alice@example.com", id: 1, name: "Alice" };
const BOB = { email: "bob@example.com", id: 2, name: "Bob" };
const MEMBER_ROLE_ID = 3;

type Viewer = typeof ALICE;

interface RegistrationOptions {
  authenticatorSelection: { residentKey: string; userVerification: string };
  challenge: string;
  excludeCredentials: { id: string }[];
  user: { id: string };
}

interface AuthenticationOptions {
  allowCredentials?: unknown[];
  challenge: string;
  userVerification: string;
}

const json = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method: "POST",
});

const harness = ({
  accounts = {
    [ALICE.id]: { hasPassword: true, ssoProviders: [] },
    [BOB.id]: { hasPassword: true, ssoProviders: [] },
  },
  passkeys: initialPasskeys = AUTHORIZATION.passkeys,
}: {
  accounts?: Record<number, MemoryPasskeyAccount>;
  passkeys?: Authorization["passkeys"];
} = {}) => {
  let passkeys = initialPasskeys;
  let password = AUTHORIZATION.password;
  const memory = createMemoryPasskeyStore(accounts);
  vi.spyOn(PasskeyModel.prototype, "store", "get").mockReturnValue(
    memory.store,
  );
  const createSession = vi
    .spyOn(SessionModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "session-token" });
  const createAdminSession = vi
    .spyOn(SessionAdminModel.prototype, "createSessionByUserId")
    .mockResolvedValue({ token: "admin-token" });
  const memoryDb = createMemoryDb([
    [
      core_users,
      [ALICE, BOB].map(user => ({ ...user, roleId: MEMBER_ROLE_ID })),
    ],
    [core_roles, [{ id: MEMBER_ROLE_ID, root: false }]],
    [core_admin_permissions, []],
  ]);
  let adminViewer: null | Viewer = null;
  vi.spyOn(SessionAdminModel.prototype, "getSession").mockImplementation(
    async () =>
      Promise.resolve(
        (adminViewer
          ? { expiresAt: new Date(Date.now() + 60_000), user: adminViewer }
          : null) as unknown as Awaited<
          ReturnType<SessionAdminModel["getSession"]>
        >,
      ),
  );
  const emit = vi.fn(async () => Promise.resolve(undefined));

  let viewer: null | Viewer = null;
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("core", {
      authorization: { ...AUTHORIZATION, passkeys, password },
    } as EnvVariablesVitNode["core"]);
    c.set("user", viewer as unknown as Context["var"]["user"]);
    c.set("db", memoryDb.db as unknown as Context["var"]["db"]);
    c.set("events", { emit } as unknown as Context["var"]["events"]);
    await next();
  });
  app.route("/", passkeysUserModule.hono);

  let jar = new Map<string, string>();

  const request = async (path: string, init: RequestInit = {}) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`);
    const headers = new Headers(init.headers);
    if (cookie.length > 0) headers.set("cookie", cookie.join("; "));
    headers.set("user-agent", "Mozilla/5.0 (Macintosh; Mac OS X) Firefox/140");

    const response = await app.request(path, { ...init, headers });

    for (const line of response.headers.getSetCookie()) {
      const [pair = ""] = line.split(";");
      const [name = "", value = ""] = pair.split("=");
      if (/max-age=0/i.test(line) || value === "") jar.delete(name);
      else jar.set(name, value);
    }

    return response;
  };

  return {
    ...memory,
    createAdminSession,
    createSession,
    emit,
    request,
    cookies: () => new Map(jar),
    restoreCookies: (cookies: Map<string, string>) => {
      jar = new Map(cookies);
    },
    disablePasskeys: () => {
      passkeys = { enabled: false, problems: [] };
    },
    disablePasswordSignIn: () => {
      password = { enabled: false };
    },
    grantStaff: async (user: Viewer) => {
      await memoryDb.db.insert(core_admin_permissions).values({
        permissions: [],
        roleId: null,
        unrestricted: false,
        userId: user.id,
      });
    },
    revokeStaff: async (user: Viewer) => {
      await memoryDb.db
        .delete(core_admin_permissions)
        .where(eq(core_admin_permissions.userId, user.id));
    },
    signInToAdminAs: (user: null | Viewer) => {
      adminViewer = user;
    },
    signInAs: (user: null | Viewer) => {
      viewer = user;
    },
    switchBrowser: () => {
      jar = new Map();
    },
  };
};

type Harness = ReturnType<typeof harness>;
type Authenticator = ReturnType<typeof createSoftwareAuthenticator>;

const startRegistration = async (h: Harness) => {
  const response = await h.request("/register/options", { method: "POST" });
  expect(response.status).toBe(200);

  return (await response.json()) as RegistrationOptions;
};

const register = async (
  h: Harness,
  authenticator: Authenticator,
  { name, overrides }: { name?: string; overrides?: CeremonyOverrides } = {},
) => {
  const options = await startRegistration(h);
  const credential = authenticator.createCredential({
    challenge: options.challenge,
    overrides,
    userId: options.user.id,
  });

  return await h.request("/register", json({ name, response: credential }));
};

const startSignIn = async (h: Harness) => {
  const response = await h.request("/sign-in/options", { method: "POST" });
  expect(response.status).toBe(200);

  return (await response.json()) as AuthenticationOptions;
};

const signIn = async (
  h: Harness,
  authenticator: Authenticator,
  overrides?: CeremonyOverrides,
) => {
  const options = await startSignIn(h);
  const assertion = authenticator.getAssertion({
    challenge: options.challenge,
    overrides,
  });

  return await h.request("/sign-in", json({ response: assertion }));
};

const newAuthenticator = (aaguid?: string) =>
  createSoftwareAuthenticator({ aaguid, origin: ORIGIN, rpId: RP_ID });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("passkey registration", () => {
  it("saves a passkey for the signed-in user", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await register(h, newAuthenticator(), {
      name: "  Work   laptop ",
    });

    expect(response.status).toBe(201);
    const { passkey } = (await response.json()) as {
      passkey: { name: string };
    };
    expect(passkey.name).toBe("Work laptop");

    const [saved] = [...h.passkeys.values()];
    expect(saved).toMatchObject({
      backedUp: true,
      deviceType: "multiDevice",
      transports: ["internal", "hybrid"],
      userId: ALICE.id,
    });
    expect(h.emit).toHaveBeenCalledWith("user.passkey.created", {
      passkeyId: saved?.id,
      userId: ALICE.id,
    });
  });

  it("asks for a discoverable, user-verified credential", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const options = await startRegistration(h);

    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "required",
    });
  });

  it("names a passkey after its authenticator when no name is given", async () => {
    const h = harness();
    h.signInAs(ALICE);

    await register(h, newAuthenticator("fbfc3007-154e-4ecc-8c0b-6e020557d7bd"));
    await register(h, newAuthenticator());

    expect([...h.passkeys.values()].map(passkey => passkey.name)).toEqual([
      "iCloud Keychain",
      "Firefox (Mac OS)",
    ]);
  });

  it("reuses one WebAuthn user id and excludes registered credentials", async () => {
    const h = harness();
    h.signInAs(ALICE);
    const first = newAuthenticator();
    await register(h, first);

    const options = await startRegistration(h);

    expect(options.user.id).toBe([...h.passkeys.values()][0]?.webauthnUserId);
    expect(options.excludeCredentials.map(({ id }) => id)).toEqual([
      first.credentialId,
    ]);
  });

  it("refuses a guest", async () => {
    const h = harness();

    const response = await h.request("/register/options", { method: "POST" });

    expect(response.status).toBe(401);
  });

  it("refuses to register the same credential twice", async () => {
    const h = harness();
    h.signInAs(ALICE);
    const authenticator = newAuthenticator();
    await register(h, authenticator);

    const response = await register(h, authenticator);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_registered" });
  });

  it("answers 404 when passkeys are disabled", async () => {
    const h = harness({ passkeys: { enabled: false, problems: [] } });
    h.signInAs(ALICE);

    const response = await h.request("/register/options", { method: "POST" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "passkeys_disabled" });
  });
});

describe("passkey registration challenges", () => {
  it("rejects a credential signed over a different challenge", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await register(h, newAuthenticator(), {
      overrides: { challenge: "c29tZS1vdGhlci1jaGFsbGVuZ2U" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "verification_failed" });
    expect(h.passkeys.size).toBe(0);
  });

  it("consumes the challenge, so a replayed response is refused", async () => {
    const h = harness();
    h.signInAs(ALICE);
    const options = await startRegistration(h);
    const cookies = h.cookies();
    const credential = newAuthenticator().createCredential({
      challenge: options.challenge,
      userId: options.user.id,
    });

    const first = await h.request("/register", json({ response: credential }));
    h.restoreCookies(cookies);
    const replay = await h.request("/register", json({ response: credential }));

    expect(first.status).toBe(201);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "invalid_challenge" });
    expect(h.challenges.size).toBe(0);
  });

  it("refuses a challenge issued to another browser", async () => {
    const h = harness();
    h.signInAs(ALICE);
    const options = await startRegistration(h);
    const credential = newAuthenticator().createCredential({
      challenge: options.challenge,
      userId: options.user.id,
    });

    h.switchBrowser();
    const response = await h.request(
      "/register",
      json({ response: credential }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_challenge" });
  });

  it("refuses a challenge issued to another account", async () => {
    const h = harness();
    h.signInAs(ALICE);
    const options = await startRegistration(h);
    const credential = newAuthenticator().createCredential({
      challenge: options.challenge,
      userId: options.user.id,
    });

    h.signInAs(BOB);
    const response = await h.request(
      "/register",
      json({ response: credential }),
    );

    expect(response.status).toBe(400);
    expect(h.passkeys.size).toBe(0);
  });

  it("refuses a challenge older than five minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const h = harness();
    h.signInAs(ALICE);
    const options = await startRegistration(h);
    const credential = newAuthenticator().createCredential({
      challenge: options.challenge,
      userId: options.user.id,
    });

    vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
    const response = await h.request(
      "/register",
      json({ response: credential }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_challenge" });
  });

  it("clears expired challenges when a new ceremony starts", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const h = harness();
    h.signInAs(ALICE);
    await startRegistration(h);
    h.switchBrowser();

    vi.setSystemTime(Date.now() + 6 * 60_000);
    await startSignIn(h);

    expect([...h.challenges.values()].map(row => row.ceremony)).toEqual([
      "authentication",
    ]);
  });

  it("refuses a sign-in challenge presented to registration", async () => {
    const h = harness();
    h.signInAs(ALICE);
    await startSignIn(h);
    const signInToken = h.cookies().get("vitnode_auth_passkey_authentication");
    const options = await startRegistration(h);
    const credential = newAuthenticator().createCredential({
      challenge: options.challenge,
      userId: options.user.id,
    });

    h.restoreCookies(
      new Map([["vitnode_auth_passkey_registration", signInToken ?? ""]]),
    );
    const response = await h.request(
      "/register",
      json({ response: credential }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_challenge" });
  });

  it("rejects a response from the wrong origin", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await register(h, newAuthenticator(), {
      overrides: { origin: "https://evil.example" },
    });

    expect(response.status).toBe(400);
    expect(h.passkeys.size).toBe(0);
  });

  it("rejects a credential scoped to another RP ID", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await register(h, newAuthenticator(), {
      overrides: { rpId: "evil.example" },
    });

    expect(response.status).toBe(400);
    expect(h.passkeys.size).toBe(0);
  });

  it("rejects a credential created without user verification", async () => {
    const h = harness();
    h.signInAs(ALICE);

    const response = await register(h, newAuthenticator(), {
      overrides: { userVerified: false },
    });

    expect(response.status).toBe(400);
    expect(h.passkeys.size).toBe(0);
  });
});

describe("passkey sign-in", () => {
  const registered = async (setup?: (authenticator: Authenticator) => void) => {
    const h = harness();
    const authenticator = newAuthenticator();
    setup?.(authenticator);
    h.signInAs(ALICE);
    await register(h, authenticator);
    h.signInAs(null);
    h.switchBrowser();

    return { authenticator, h };
  };

  it("offers discoverable credentials without asking for an email", async () => {
    const { h } = await registered();

    const options = await startSignIn(h);

    expect(options.allowCredentials ?? []).toEqual([]);
    expect(options.userVerification).toBe("required");
  });

  it("creates a normal session for the passkey's owner", async () => {
    const { authenticator, h } = await registered();

    const response = await signIn(h, authenticator);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ALICE.id });
    expect(h.createSession).toHaveBeenCalledWith(ALICE.id);
    expect(h.createAdminSession).not.toHaveBeenCalled();
    expect([...h.passkeys.values()][0]?.lastUsedAt).toBeInstanceOf(Date);
  });

  it("never trusts a user id supplied by the browser", async () => {
    const { authenticator, h } = await registered();
    const options = await startSignIn(h);
    const assertion = authenticator.getAssertion({
      challenge: options.challenge,
    });

    const response = await h.request(
      "/sign-in",
      json({ response: assertion, userId: BOB.id }),
    );

    expect(response.status).toBe(201);
    expect(h.createSession).toHaveBeenCalledWith(ALICE.id);
  });

  it("refuses a user handle that does not belong to the credential", async () => {
    const { authenticator, h } = await registered();

    const response = await signIn(h, authenticator, {
      userHandle: "Ym9iLWhhbmRsZQ",
    });

    expect(response.status).toBe(403);
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("refuses a reused sign-in challenge", async () => {
    const { authenticator, h } = await registered();
    const options = await startSignIn(h);
    const cookies = h.cookies();
    const assertion = authenticator.getAssertion({
      challenge: options.challenge,
    });

    const first = await h.request("/sign-in", json({ response: assertion }));
    h.restoreCookies(cookies);
    const replay = await h.request("/sign-in", json({ response: assertion }));

    expect(first.status).toBe(201);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "invalid_challenge" });
    expect(h.createSession).toHaveBeenCalledTimes(1);
  });

  it("refuses an assertion over the wrong challenge", async () => {
    const { authenticator, h } = await registered();

    const response = await signIn(h, authenticator, {
      challenge: "bm90LXRoZS1pc3N1ZWQtY2hhbGxlbmdl",
    });

    expect(response.status).toBe(403);
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("refuses an assertion from the wrong origin", async () => {
    const { authenticator, h } = await registered();

    const response = await signIn(h, authenticator, {
      origin: "https://community.example.com.evil.example",
    });

    expect(response.status).toBe(403);
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("refuses an assertion for the wrong RP ID", async () => {
    const { authenticator, h } = await registered();

    const response = await signIn(h, authenticator, { rpId: "evil.example" });

    expect(response.status).toBe(403);
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("refuses an assertion without user verification", async () => {
    const { authenticator, h } = await registered();

    const response = await signIn(h, authenticator, { userVerified: false });

    expect(response.status).toBe(403);
  });

  it("refuses an unknown credential", async () => {
    const { h } = await registered();

    const response = await signIn(h, newAuthenticator());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "verification_failed" });
  });

  it("accepts authenticators that always report a zero counter", async () => {
    const { authenticator, h } = await registered();

    const first = await signIn(h, authenticator);
    const second = await signIn(h, authenticator);

    expect([first.status, second.status]).toEqual([201, 201]);
    expect([...h.passkeys.values()][0]?.counter).toBe(0);
  });

  it("stores an increasing counter and refuses one that goes backwards", async () => {
    const { authenticator, h } = await registered(a => a.setCounter(5));

    const forward = await signIn(h, authenticator);
    expect(forward.status).toBe(201);
    expect([...h.passkeys.values()][0]?.counter).toBe(6);

    const cloned = await signIn(h, authenticator, { counter: 6 });
    expect(cloned.status).toBe(403);

    const reset = await signIn(h, authenticator, { counter: 0 });
    expect(reset.status).toBe(403);
    expect(h.createSession).toHaveBeenCalledTimes(1);
  });
});

describe("passkey management", () => {
  const withPasskeys = async (
    accounts?: Record<number, MemoryPasskeyAccount>,
  ) => {
    const h = harness({ accounts });
    h.signInAs(ALICE);
    await register(h, newAuthenticator(), { name: "Alice phone" });
    h.signInAs(BOB);
    await register(h, newAuthenticator(), { name: "Bob laptop" });
    const [alicePasskey, bobPasskey] = [...h.passkeys.values()];

    return {
      alicePasskeyId: alicePasskey?.id ?? 0,
      bobPasskeyId: bobPasskey?.id ?? 0,
      h,
    };
  };

  it("lists only the signed-in user's passkeys", async () => {
    const { h } = await withPasskeys();
    h.signInAs(ALICE);

    const response = await h.request("/");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      passkeys: { name: string }[];
    };
    expect(body.passkeys.map(({ name }) => name)).toEqual(["Alice phone"]);
  });

  it("renames a passkey", async () => {
    const { alicePasskeyId, h } = await withPasskeys();
    h.signInAs(ALICE);

    const response = await h.request(`/${alicePasskeyId}`, {
      ...json({ name: "Travel phone" }),
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(h.passkeys.get(alicePasskeyId)?.name).toBe("Travel phone");
    expect(h.emit).toHaveBeenCalledWith("user.passkey.updated", {
      name: "Travel phone",
      passkeyId: alicePasskeyId,
      userId: ALICE.id,
    });
  });

  it("refuses to rename another user's passkey", async () => {
    const { bobPasskeyId, h } = await withPasskeys();
    h.signInAs(ALICE);

    const response = await h.request(`/${bobPasskeyId}`, {
      ...json({ name: "Mine now" }),
      method: "PATCH",
    });

    expect(response.status).toBe(404);
    expect(h.passkeys.get(bobPasskeyId)?.name).toBe("Bob laptop");
  });

  it("refuses to delete another user's passkey", async () => {
    const { bobPasskeyId, h } = await withPasskeys();
    h.signInAs(ALICE);

    const response = await h.request(`/${bobPasskeyId}`, { method: "DELETE" });

    expect(response.status).toBe(404);
    expect(h.passkeys.has(bobPasskeyId)).toBe(true);
  });

  it("refuses management routes to a guest", async () => {
    const { alicePasskeyId, h } = await withPasskeys();
    h.signInAs(null);

    const list = await h.request("/");
    const remove = await h.request(`/${alicePasskeyId}`, { method: "DELETE" });

    expect([list.status, remove.status]).toEqual([401, 401]);
    expect(h.passkeys.has(alicePasskeyId)).toBe(true);
  });

  it("deletes a passkey when the account keeps its password", async () => {
    const { alicePasskeyId, h } = await withPasskeys();
    h.signInAs(ALICE);

    const response = await h.request(`/${alicePasskeyId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(h.passkeys.has(alicePasskeyId)).toBe(false);
    expect(h.emit).toHaveBeenCalledWith("user.passkey.deleted", {
      passkeyId: alicePasskeyId,
      userId: ALICE.id,
    });
  });

  it("keeps the last passkey of an account with no other way to sign in", async () => {
    const { alicePasskeyId, h } = await withPasskeys({
      [ALICE.id]: { hasPassword: false, ssoProviders: [] },
    });
    h.signInAs(ALICE);

    const response = await h.request(`/${alicePasskeyId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "last_recovery_method" });
    expect(h.passkeys.has(alicePasskeyId)).toBe(true);
  });

  it("lets a passwordless account delete its last passkey when SSO is linked", async () => {
    const { alicePasskeyId, h } = await withPasskeys({
      [ALICE.id]: { hasPassword: false, ssoProviders: ["github"] },
    });
    h.signInAs(ALICE);

    const response = await h.request(`/${alicePasskeyId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
  });

  it("ignores SSO links to a provider that is no longer configured", async () => {
    const { alicePasskeyId, h } = await withPasskeys({
      [ALICE.id]: { hasPassword: false, ssoProviders: ["gitlab"] },
    });
    h.signInAs(ALICE);

    const response = await h.request(`/${alicePasskeyId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "last_recovery_method" });
    expect(h.passkeys.has(alicePasskeyId)).toBe(true);
  });

  it("closes every management route when passkeys are switched off", async () => {
    const { alicePasskeyId, h } = await withPasskeys();
    h.signInAs(ALICE);
    h.disablePasskeys();

    const list = await h.request("/");
    const rename = await h.request(`/${alicePasskeyId}`, {
      ...json({ name: "Nope" }),
      method: "PATCH",
    });
    const remove = await h.request(`/${alicePasskeyId}`, { method: "DELETE" });

    expect([list.status, rename.status, remove.status]).toEqual([
      404, 404, 404,
    ]);
    expect(await list.json()).toEqual({ error: "passkeys_disabled" });
    expect(h.passkeys.get(alicePasskeyId)?.name).toBe("Alice phone");
  });

  it("stops counting a password as a way in once password sign-in is off", async () => {
    const { alicePasskeyId, h } = await withPasskeys();
    h.signInAs(ALICE);
    h.disablePasswordSignIn();

    const response = await h.request(`/${alicePasskeyId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "last_recovery_method" });
    expect(h.passkeys.has(alicePasskeyId)).toBe(true);
  });
});

const ADMIN_CHALLENGE_COOKIE = "vitnode_auth_passkey_admin_sign_in";
const PUBLIC_CHALLENGE_COOKIE = "vitnode_auth_passkey_authentication";

const startAdminSignIn = async (h: Harness) => {
  const response = await h.request("/admin-sign-in/options", {
    method: "POST",
  });
  expect(response.status).toBe(200);

  return (await response.json()) as AuthenticationOptions;
};

const adminSignIn = async (
  h: Harness,
  authenticator: Authenticator,
  overrides?: CeremonyOverrides,
) => {
  const options = await startAdminSignIn(h);
  const assertion = authenticator.getAssertion({
    challenge: options.challenge,
    overrides,
  });

  return await h.request("/admin-sign-in", json({ response: assertion }));
};

const enrolled = async ({ asStaff = true }: { asStaff?: boolean } = {}) => {
  const h = harness();
  const authenticator = newAuthenticator();
  if (asStaff) {
    await h.grantStaff(ALICE);
    h.signInToAdminAs(ALICE);
  }
  h.signInAs(ALICE);
  const registration = await register(h, authenticator);
  expect(registration.status).toBe(201);
  h.signInAs(null);
  h.signInToAdminAs(null);
  h.switchBrowser();

  return { authenticator, h };
};

describe("AdminCP passkey sign-in", () => {
  it("issues a fresh two-minute AdminCP challenge that requires user verification", async () => {
    vi.useFakeTimers({
      now: new Date("2026-09-28T12:00:00Z"),
      toFake: ["Date"],
    });
    const { h } = await enrolled();

    const publicOptions = await startSignIn(h);
    const options = await startAdminSignIn(h);

    expect(options.userVerification).toBe("required");
    expect(options.allowCredentials ?? []).toEqual([]);
    expect(options.challenge).not.toBe(publicOptions.challenge);
    expect(h.cookies().has(ADMIN_CHALLENGE_COOKIE)).toBe(true);

    const adminChallenge = [...h.challenges.values()].find(
      row => row.ceremony === "admin_sign_in",
    );
    expect(adminChallenge).toMatchObject({
      challenge: options.challenge,
      expiresAt: new Date("2026-09-28T12:02:00Z"),
      userId: null,
    });
  });

  it("starts an AdminCP session for a staff member's passkey", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);

    const response = await adminSignIn(h, authenticator);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ALICE.id });
    expect(h.createAdminSession).toHaveBeenCalledExactlyOnceWith(ALICE.id);
    expect(h.createSession).not.toHaveBeenCalled();
    expect(h.cookies().has(ADMIN_CHALLENGE_COOKIE)).toBe(false);
  });

  it("refuses a regular member's passkey", async () => {
    const { authenticator, h } = await enrolled({ asStaff: false });

    const response = await adminSignIn(h, authenticator);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not_staff" });
    expect(h.createAdminSession).not.toHaveBeenCalled();
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("refuses a staff member whose access was removed after enrolling", async () => {
    const { authenticator, h } = await enrolled();
    await h.revokeStaff(ALICE);

    const response = await adminSignIn(h, authenticator);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not_staff" });
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("refuses an assertion made without user verification", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);

    const response = await adminSignIn(h, authenticator, {
      userVerified: false,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "verification_failed" });
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("refuses a challenge older than two minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);
    const options = await startAdminSignIn(h);
    const assertion = authenticator.getAssertion({
      challenge: options.challenge,
    });

    vi.setSystemTime(Date.now() + 2 * 60_000 + 1);
    const response = await h.request(
      "/admin-sign-in",
      json({ response: assertion }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_challenge" });
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("refuses a reused AdminCP challenge", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);
    const options = await startAdminSignIn(h);
    const cookies = h.cookies();
    const assertion = authenticator.getAssertion({
      challenge: options.challenge,
    });

    const first = await h.request(
      "/admin-sign-in",
      json({ response: assertion }),
    );
    h.restoreCookies(cookies);
    const replay = await h.request(
      "/admin-sign-in",
      json({ response: assertion }),
    );

    expect(first.status).toBe(201);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "invalid_challenge" });
    expect(h.createAdminSession).toHaveBeenCalledTimes(1);
  });

  it("refuses a public sign-in challenge presented to the AdminCP", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);
    const options = await startSignIn(h);
    const assertion = authenticator.getAssertion({
      challenge: options.challenge,
    });

    h.restoreCookies(
      new Map([
        [
          ADMIN_CHALLENGE_COOKIE,
          h.cookies().get(PUBLIC_CHALLENGE_COOKIE) ?? "",
        ],
      ]),
    );
    const response = await h.request(
      "/admin-sign-in",
      json({ response: assertion }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_challenge" });
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("refuses an AdminCP challenge presented to public sign-in", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);
    const options = await startAdminSignIn(h);
    const assertion = authenticator.getAssertion({
      challenge: options.challenge,
    });

    h.restoreCookies(
      new Map([
        [
          PUBLIC_CHALLENGE_COOKIE,
          h.cookies().get(ADMIN_CHALLENGE_COOKIE) ?? "",
        ],
      ]),
    );
    const response = await h.request("/sign-in", json({ response: assertion }));

    expect(response.status).toBe(400);
    expect(h.createSession).not.toHaveBeenCalled();
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("refuses a registration challenge presented to the AdminCP", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);
    h.signInAs(ALICE);
    h.signInToAdminAs(ALICE);
    const registration = await startRegistration(h);
    const assertion = authenticator.getAssertion({
      challenge: registration.challenge,
    });

    h.restoreCookies(
      new Map([
        [
          ADMIN_CHALLENGE_COOKIE,
          h.cookies().get("vitnode_auth_passkey_registration") ?? "",
        ],
      ]),
    );
    const response = await h.request(
      "/admin-sign-in",
      json({ response: assertion }),
    );

    expect(response.status).toBe(400);
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("refuses an assertion from the wrong origin", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);

    const response = await adminSignIn(h, authenticator, {
      origin: "https://admin.evil.example",
    });

    expect(response.status).toBe(403);
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("refuses an assertion for the wrong RP ID", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);

    const response = await adminSignIn(h, authenticator, {
      rpId: "evil.example",
    });

    expect(response.status).toBe(403);
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("never turns a public session into an AdminCP session", async () => {
    const { h } = await enrolled();
    await h.grantStaff(ALICE);
    h.signInAs(ALICE);

    const withoutChallenge = await h.request(
      "/admin-sign-in",
      json({ response: newAuthenticator().getAssertion({ challenge: "" }) }),
    );

    expect(withoutChallenge.status).toBe(400);
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("keeps public passkey sign-in public, even for staff", async () => {
    const { authenticator, h } = await enrolled();
    await h.grantStaff(ALICE);

    const response = await signIn(h, authenticator);

    expect(response.status).toBe(201);
    expect(h.createSession).toHaveBeenCalledExactlyOnceWith(ALICE.id);
    expect(h.createAdminSession).not.toHaveBeenCalled();
  });

  it("answers 404 when passkeys are disabled", async () => {
    const h = harness({ passkeys: { enabled: false, problems: [] } });

    const response = await h.request("/admin-sign-in/options", {
      method: "POST",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "passkeys_disabled" });
  });
});

describe("staff passkey enrollment", () => {
  it("asks staff to open the AdminCP before adding a passkey", async () => {
    const h = harness();
    await h.grantStaff(ALICE);
    h.signInAs(ALICE);

    const response = await h.request("/register/options", { method: "POST" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "admin_session_required" });
    expect(h.challenges.size).toBe(0);
  });

  it("refuses an AdminCP session that belongs to someone else", async () => {
    const h = harness();
    await h.grantStaff(ALICE);
    h.signInAs(ALICE);
    h.signInToAdminAs(BOB);

    const response = await h.request("/register/options", { method: "POST" });

    expect(response.status).toBe(403);
  });

  it("refuses to save the passkey when the AdminCP session ended mid-ceremony", async () => {
    const h = harness();
    await h.grantStaff(ALICE);
    h.signInAs(ALICE);
    h.signInToAdminAs(ALICE);
    const options = await startRegistration(h);
    const credential = newAuthenticator().createCredential({
      challenge: options.challenge,
      userId: options.user.id,
    });

    h.signInToAdminAs(null);
    const response = await h.request(
      "/register",
      json({ response: credential }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "admin_session_required" });
    expect(h.passkeys.size).toBe(0);
  });

  it("lets staff with their own AdminCP session add a passkey", async () => {
    const h = harness();
    await h.grantStaff(ALICE);
    h.signInAs(ALICE);
    h.signInToAdminAs(ALICE);

    const response = await register(h, newAuthenticator());

    expect(response.status).toBe(201);
    expect(h.passkeys.size).toBe(1);
  });
});
