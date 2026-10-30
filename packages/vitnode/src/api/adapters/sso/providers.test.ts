import { HTTPException } from "hono/http-exception";
import {
  decodeProtectedHeader,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  SignJWT,
} from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SSOApiPlugin, SSOTokenResponse } from "@/api/models/sso";

import { AppleSSOApiPlugin, createAppleClientSecret } from "./apple";
import { AtlassianSSOApiPlugin } from "./atlassian";
import { GitLabSSOApiPlugin, normalizeGitLabIssuer } from "./gitlab";
import { KickSSOApiPlugin } from "./kick";
import { LinkedInSSOApiPlugin } from "./linkedin";
import {
  MICROSOFT_CONSUMERS_TENANT_ID,
  MicrosoftSSOApiPlugin,
  microsoftTenantAllowed,
} from "./microsoft";
import { PayPalSSOApiPlugin } from "./paypal";
import { RedditSSOApiPlugin } from "./reddit";
import { SlackSSOApiPlugin } from "./slack";
import { TikTokSSOApiPlugin } from "./tiktok";
import { TwitchSSOApiPlugin } from "./twitch";
import { TwitterSSOApiPlugin } from "./twitter";

const creds = { clientId: "client", clientSecret: "secret" };

const REQUEST = {
  codeChallenge: "challenge",
  codeChallengeMethod: "S256" as const,
  nonce: "nonce-1",
  state: "state-1",
};

const CONTEXT = { codeVerifier: "verifier", nonce: "nonce-1", params: {} };

const TENANT = "11111111-2222-3333-4444-555555555555";

let rsa: Awaited<ReturnType<typeof generateKeyPair>>;
let apple: { pem: string; publicKey: CryptoKey };

beforeAll(async () => {
  rsa = await generateKeyPair("RS256");
  const ec = await generateKeyPair("ES256", { extractable: true });
  const pkcs8 = Buffer.from(
    await crypto.subtle.exportKey("pkcs8", ec.privateKey),
  ).toString("base64");
  apple = {
    pem: `-----BEGIN PRIVATE KEY-----\\n${pkcs8}\\n-----END PRIVATE KEY-----`,
    publicKey: ec.publicKey,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

interface Call {
  body: undefined | URLSearchParams;
  headers: Headers;
  url: URL;
}

/** Answers `fetch` by URL prefix, longest first, and records every call. */
const route = (answers: Record<string, unknown>) => {
  const calls: Call[] = [];
  const jwk = exportJWK(rsa.publicKey);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({
        body: init?.body instanceof URLSearchParams ? init.body : undefined,
        headers: new Headers(init?.headers),
        url,
      });
      if (/\/(keys|jwks)$/.test(url.pathname)) {
        return Response.json({
          keys: [{ ...(await jwk), alg: "RS256", kid: "k1", use: "sig" }],
        });
      }
      const match = Object.keys(answers)
        .sort((a, b) => b.length - a.length)
        .find(prefix => url.href.startsWith(prefix));
      if (!match) return new Response("not found", { status: 404 });

      return Response.json(answers[match]);
    }),
  );

  return calls;
};

const idToken = async (claims: Record<string, unknown>) =>
  await new SignJWT({ nonce: "nonce-1", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(rsa.privateKey);

const statusOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error instanceof HTTPException ? error.status : "error";
  }

  return "resolved";
};

const signIn = async (adapter: SSOApiPlugin) => {
  const token: SSOTokenResponse = await adapter.fetchToken("code-1", CONTEXT);

  return await adapter.fetchUser(token, CONTEXT);
};

const ADAPTERS: [
  SSOApiPlugin,
  { authorize: string; nonce: boolean; pkce: boolean; scope: string },
][] = [
  [
    AppleSSOApiPlugin({
      clientId: "com.example.web",
      keyId: "ABCDEFGHIJ",
      privateKey: "unused",
      teamId: "TEAM123456",
    }),
    {
      authorize: "https://appleid.apple.com/auth/authorize",
      nonce: true,
      pkce: false,
      scope: "name email",
    },
  ],
  [
    AtlassianSSOApiPlugin(creds),
    {
      authorize: "https://auth.atlassian.com/authorize",
      nonce: false,
      pkce: false,
      scope: "read:me",
    },
  ],
  [
    GitLabSSOApiPlugin(creds),
    {
      authorize: "https://gitlab.com/oauth/authorize",
      nonce: true,
      pkce: true,
      scope: "openid profile email",
    },
  ],
  [
    KickSSOApiPlugin(creds),
    {
      authorize: "https://id.kick.com/oauth/authorize",
      nonce: false,
      pkce: true,
      scope: "user:read",
    },
  ],
  [
    LinkedInSSOApiPlugin(creds),
    {
      authorize: "https://www.linkedin.com/oauth/v2/authorization",
      nonce: false,
      pkce: false,
      scope: "openid profile email",
    },
  ],
  [
    MicrosoftSSOApiPlugin(creds),
    {
      authorize:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      nonce: true,
      pkce: true,
      scope: "openid profile email",
    },
  ],
  [
    PayPalSSOApiPlugin({ ...creds, environment: "live" }),
    {
      authorize: "https://www.paypal.com/signin/authorize",
      nonce: false,
      pkce: false,
      scope: "openid email profile",
    },
  ],
  [
    RedditSSOApiPlugin(creds),
    {
      authorize: "https://www.reddit.com/api/v1/authorize",
      nonce: false,
      pkce: false,
      scope: "identity",
    },
  ],
  [
    SlackSSOApiPlugin(creds),
    {
      authorize: "https://slack.com/openid/connect/authorize",
      nonce: true,
      pkce: false,
      scope: "openid profile email",
    },
  ],
  [
    TikTokSSOApiPlugin({ clientKey: "client", clientSecret: "secret" }),
    {
      authorize: "https://www.tiktok.com/v2/auth/authorize/",
      nonce: false,
      pkce: false,
      scope: "user.info.basic",
    },
  ],
  [
    TwitchSSOApiPlugin(creds),
    {
      authorize: "https://id.twitch.tv/oauth2/authorize",
      nonce: true,
      pkce: false,
      scope: "openid user:read:email",
    },
  ],
  [
    TwitterSSOApiPlugin(creds),
    {
      authorize: "https://x.com/i/oauth2/authorize",
      nonce: false,
      pkce: true,
      scope: "tweet.read users.read users.email",
    },
  ],
];

describe("the authorization URL", () => {
  it.each(
    ADAPTERS.map(
      ([adapter, expected]) => [adapter.id, adapter, expected] as const,
    ),
  )(
    "%s asks for the minimal scopes and returns to its own callback",
    (id, adapter, expected) => {
      const url = new URL(adapter.getUrl(REQUEST));
      const params = url.searchParams;

      expect(`${url.origin}${url.pathname}`).toBe(expected.authorize);
      expect(params.get("redirect_uri")).toBe(
        `http://localhost:3000/login/sso/${id}`,
      );
      expect(params.get("state")).toBe("state-1");
      expect(params.get("response_type")).toBe("code");
      expect(params.get("scope")).toBe(expected.scope);
      expect(params.get("code_challenge")).toBe(
        expected.pkce ? "challenge" : null,
      );
      expect(params.get("code_challenge_method")).toBe(
        expected.pkce ? "S256" : null,
      );
      expect(params.get("nonce")).toBe(expected.nonce ? "nonce-1" : null);
    },
  );

  it("names TikTok's client ID `client_key`", () => {
    const url = new URL(
      TikTokSSOApiPlugin({ clientKey: "key", clientSecret: "s" }).getUrl(
        REQUEST,
      ),
    );

    expect(url.searchParams.get("client_key")).toBe("key");
    expect(url.searchParams.has("client_id")).toBe(false);
  });

  it("asks Apple to post the callback, and Reddit for a token without refresh", () => {
    const appleUrl = new URL(ADAPTERS[0][0].getUrl(REQUEST));
    const redditUrl = new URL(RedditSSOApiPlugin(creds).getUrl(REQUEST));

    expect(appleUrl.searchParams.get("response_mode")).toBe("form_post");
    expect(redditUrl.searchParams.get("duration")).toBe("temporary");
  });

  it("leaves `users.email` out for an X app without email access", () => {
    const url = new URL(
      TwitterSSOApiPlugin({ ...creds, requestEmail: false }).getUrl(REQUEST),
    );

    expect(url.searchParams.get("scope")).toBe("tweet.read users.read");
  });
});

describe("missing credentials", () => {
  it.each(ADAPTERS.map(([adapter]) => [adapter.id] as const))(
    "%s keeps its button but refuses to start or finish a sign-in",
    async id => {
      const factories: Record<string, () => SSOApiPlugin> = {
        apple: () =>
          AppleSSOApiPlugin({
            clientId: undefined,
            keyId: undefined,
            privateKey: undefined,
            teamId: undefined,
          }),
        atlassian: () =>
          AtlassianSSOApiPlugin({
            clientId: undefined,
            clientSecret: undefined,
          }),
        gitlab: () =>
          GitLabSSOApiPlugin({ clientId: undefined, clientSecret: undefined }),
        kick: () =>
          KickSSOApiPlugin({ clientId: undefined, clientSecret: undefined }),
        linkedin: () =>
          LinkedInSSOApiPlugin({
            clientId: undefined,
            clientSecret: undefined,
          }),
        microsoft: () =>
          MicrosoftSSOApiPlugin({
            clientId: undefined,
            clientSecret: undefined,
          }),
        paypal: () =>
          PayPalSSOApiPlugin({
            clientId: undefined,
            clientSecret: undefined,
            environment: "sandbox",
          }),
        reddit: () =>
          RedditSSOApiPlugin({ clientId: undefined, clientSecret: undefined }),
        slack: () =>
          SlackSSOApiPlugin({ clientId: undefined, clientSecret: undefined }),
        tiktok: () =>
          TikTokSSOApiPlugin({ clientKey: undefined, clientSecret: undefined }),
        twitch: () =>
          TwitchSSOApiPlugin({ clientId: undefined, clientSecret: undefined }),
        twitter: () =>
          TwitterSSOApiPlugin({ clientId: undefined, clientSecret: undefined }),
      };
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const adapter = factories[id]();

      expect(adapter.name.length).toBeGreaterThan(0);
      expect(() => adapter.getUrl(REQUEST)).toThrow(/^Missing /);
      await expect(adapter.fetchToken("code", CONTEXT)).rejects.toThrow(
        /^Missing /,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe("the token exchange", () => {
  const TOKEN = {
    access_token: "at",
    id_token: "it",
    ok: true,
    token_type: "Bearer",
  };

  it.each([
    [
      "atlassian",
      AtlassianSSOApiPlugin(creds),
      "https://auth.atlassian.com/oauth/token",
      "post",
      false,
    ],
    [
      "gitlab",
      GitLabSSOApiPlugin(creds),
      "https://gitlab.com/oauth/token",
      "post",
      true,
    ],
    [
      "kick",
      KickSSOApiPlugin(creds),
      "https://id.kick.com/oauth/token",
      "post",
      true,
    ],
    [
      "linkedin",
      LinkedInSSOApiPlugin(creds),
      "https://www.linkedin.com/oauth/v2/accessToken",
      "post",
      false,
    ],
    [
      "microsoft",
      MicrosoftSSOApiPlugin(creds),
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      "post",
      true,
    ],
    [
      "paypal",
      PayPalSSOApiPlugin({ ...creds, environment: "live" }),
      "https://api-m.paypal.com/v1/oauth2/token",
      "basic",
      false,
    ],
    [
      "reddit",
      RedditSSOApiPlugin(creds),
      "https://www.reddit.com/api/v1/access_token",
      "basic",
      false,
    ],
    [
      "slack",
      SlackSSOApiPlugin(creds),
      "https://slack.com/api/openid.connect.token",
      "post",
      false,
    ],
    [
      "twitch",
      TwitchSSOApiPlugin(creds),
      "https://id.twitch.tv/oauth2/token",
      "post",
      false,
    ],
    [
      "twitter",
      TwitterSSOApiPlugin(creds),
      "https://api.x.com/2/oauth2/token",
      "basic",
      true,
    ],
  ] as const)(
    "%s posts the code to its token endpoint with the right client authentication",
    async (_, adapter, tokenUrl, auth, pkce) => {
      const calls = route({ [tokenUrl]: TOKEN });

      await adapter.fetchToken("code-1", CONTEXT);

      const [call] = calls;
      expect(call?.url.href).toBe(tokenUrl);
      expect(call?.body?.get("code")).toBe("code-1");
      expect(call?.body?.get("grant_type")).toBe("authorization_code");
      expect(call?.body?.get("code_verifier")).toBe(pkce ? "verifier" : null);
      if (auth === "basic") {
        expect(call?.headers.get("authorization")).toBe(
          `Basic ${Buffer.from("client:secret").toString("base64")}`,
        );
        expect(call?.body?.has("client_secret")).toBe(false);
      } else {
        expect(call?.body?.get("client_secret")).toBe("secret");
        expect(call?.headers.has("authorization")).toBe(false);
      }
    },
  );

  it("sends TikTok's `client_key` and Reddit's own User-Agent", async () => {
    const tiktok = route({
      "https://open.tiktokapis.com/v2/oauth/token/": TOKEN,
    });
    await TikTokSSOApiPlugin({
      clientKey: "key",
      clientSecret: "s",
    }).fetchToken("code-1", CONTEXT);
    expect(tiktok[0]?.body?.get("client_key")).toBe("key");

    const reddit = route({ "https://www.reddit.com/api/v1/": TOKEN });
    await RedditSSOApiPlugin({
      ...creds,
      userAgent: "web:forum:1.0 (by /u/me)",
    }).fetchToken("code-1", CONTEXT);
    expect(reddit[0]?.headers.get("user-agent")).toBe(
      "web:forum:1.0 (by /u/me)",
    );
  });

  it("fails a token answer without an access token, or a Slack answer that is not ok", async () => {
    route({ "https://id.kick.com/oauth/token": { error: "invalid_grant" } });
    expect(
      await statusOf(KickSSOApiPlugin(creds).fetchToken("c", CONTEXT)),
    ).toBe(502);

    route({
      "https://slack.com/api/openid.connect.token": {
        error: "invalid_code",
        ok: false,
      },
    });
    expect(
      await statusOf(SlackSSOApiPlugin(creds).fetchToken("c", CONTEXT)),
    ).toBe(502);
  });
});

describe("profiles and email trust", () => {
  it("X: trusts a confirmed email and asks for the larger avatar", async () => {
    route({
      "https://api.x.com/2/oauth2/token": {
        access_token: "at",
        token_type: "bearer",
      },
      "https://api.x.com/2/users/me": {
        data: {
          confirmed_email: "alice@x.test",
          id: "1234",
          name: "Alice",
          profile_image_url:
            "https://pbs.twimg.com/profile_images/1/a_normal.jpg",
          username: "alice",
        },
      },
    });

    expect(await signIn(TwitterSSOApiPlugin(creds))).toEqual({
      avatarUrl: "https://pbs.twimg.com/profile_images/1/a_400x400.jpg",
      email: "alice@x.test",
      emailVerified: true,
      id: "1234",
      username: "Alice",
    });
  });

  it("X: an account without a confirmed email has none", async () => {
    route({
      "https://api.x.com/2/oauth2/token": {
        access_token: "at",
        token_type: "bearer",
      },
      "https://api.x.com/2/users/me": {
        data: { id: "1234", username: "alice" },
      },
    });

    expect(await signIn(TwitterSSOApiPlugin(creds))).toMatchObject({
      avatarUrl: null,
      email: null,
      emailVerified: false,
      username: "alice",
    });
  });

  it("Kick: stringifies the numeric id and never trusts the email", async () => {
    route({
      "https://id.kick.com/oauth/token": {
        access_token: "at",
        token_type: "Bearer",
      },
      "https://api.kick.com/public/v1/users": {
        data: [
          {
            email: "alice@kick.test",
            name: "alice",
            profile_picture: "https://files.kick.com/a.png",
            user_id: 42,
          },
        ],
      },
    });

    expect(await signIn(KickSSOApiPlugin(creds))).toEqual({
      avatarUrl: "https://files.kick.com/a.png",
      email: "alice@kick.test",
      emailVerified: false,
      id: "42",
      username: "alice",
    });
  });

  it("Reddit: no email, and an avatar with its entities decoded", async () => {
    const calls = route({
      "https://www.reddit.com/api/v1/access_token": {
        access_token: "at",
        token_type: "bearer",
      },
      "https://oauth.reddit.com/api/v1/me": {
        icon_img: "https://styles.redditmedia.com/a.png?width=256&amp;s=abc",
        id: "abc12",
        name: "alice",
      },
    });

    expect(await signIn(RedditSSOApiPlugin(creds))).toEqual({
      avatarUrl: "https://styles.redditmedia.com/a.png?width=256&s=abc",
      email: null,
      emailVerified: false,
      id: "abc12",
      username: "alice",
    });
    expect(calls[1]?.headers.get("user-agent")).toBe(
      "web:client:1.0 (by VitNode)",
    );
  });

  it("TikTok: keyed on open_id, with no email; an error answer or another account fails", async () => {
    const answer = (user: Record<string, unknown>, code = "ok") =>
      route({
        "https://open.tiktokapis.com/v2/oauth/token/": {
          access_token: "at",
          open_id: "open-1",
        },
        "https://open.tiktokapis.com/v2/user/info/": {
          data: { user },
          error: { code },
        },
      });
    const tiktok = TikTokSSOApiPlugin({ clientKey: "key", clientSecret: "s" });

    answer({
      avatar_url: "https://p16.tiktokcdn.test/a.jpg",
      display_name: "Alice",
      open_id: "open-1",
    });
    expect(await signIn(tiktok)).toEqual({
      avatarUrl: "https://p16.tiktokcdn.test/a.jpg",
      email: null,
      emailVerified: false,
      id: "open-1",
      username: "Alice",
    });

    answer({ open_id: "open-1" }, "access_token_invalid");
    expect(await statusOf(signIn(tiktok))).toBe(502);

    answer({ open_id: "open-2" });
    expect(await statusOf(signIn(tiktok))).toBe(502);
  });

  it.each([
    [
      "Atlassian",
      () => AtlassianSSOApiPlugin(creds),
      "https://auth.atlassian.com/oauth/token",
      "https://api.atlassian.com/me",
      {
        account_id: "acc-1",
        nickname: "alice",
        picture: "https://avatar.atl.test/a.png",
      },
    ],
    [
      "LinkedIn",
      () => LinkedInSSOApiPlugin(creds),
      "https://www.linkedin.com/oauth/v2/accessToken",
      "https://api.linkedin.com/v2/userinfo",
      { family_name: "Smith", given_name: "Alice", sub: "acc-1" },
    ],
  ] as const)(
    "%s: trusts the email only with email_verified: true",
    async (_, make, tokenUrl, profileUrl, profile) => {
      for (const [emailVerified, trusted] of [
        [true, true],
        [false, false],
        [undefined, false],
      ] as const) {
        route({
          [profileUrl]: {
            ...profile,
            email: "alice@example.test",
            email_verified: emailVerified,
          },
          [tokenUrl]: { access_token: "at" },
        });

        expect(await signIn(make())).toMatchObject({
          email: "alice@example.test",
          emailVerified: trusted,
          id: "acc-1",
        });
      }
    },
  );

  it("LinkedIn: maps given and family name without splitting the display name", async () => {
    route({
      "https://www.linkedin.com/oauth/v2/accessToken": { access_token: "at" },
      "https://api.linkedin.com/v2/userinfo": {
        name: "Alice Mary Smith",
        sub: "acc-1",
      },
    });

    expect(await signIn(LinkedInSSOApiPlugin(creds))).toMatchObject({
      firstName: null,
      lastName: null,
      username: "Alice Mary Smith",
    });
  });

  it("PayPal: picks the sandbox or live endpoints, and trusts only a confirmed primary email", async () => {
    for (const [environment, api] of [
      ["sandbox", "https://api-m.sandbox.paypal.com"],
      ["live", "https://api-m.paypal.com"],
    ] as const) {
      const calls = route({
        [`${api}/v1/identity/oauth2/userinfo`]: {
          emails: [
            { confirmed: false, primary: false, value: "old@paypal.test" },
            { confirmed: true, primary: true, value: "alice@paypal.test" },
          ],
          family_name: "Smith",
          given_name: "Alice",
          name: "Alice Smith",
          user_id: "https://www.paypal.com/webapps/auth/identity/user/abc",
        },
        [`${api}/v1/oauth2/token`]: {
          access_token: "at",
          token_type: "Bearer",
        },
      });

      expect(
        await signIn(PayPalSSOApiPlugin({ ...creds, environment })),
      ).toEqual({
        email: "alice@paypal.test",
        emailVerified: true,
        firstName: "Alice",
        id: "https://www.paypal.com/webapps/auth/identity/user/abc",
        lastName: "Smith",
        username: "Alice Smith",
      });
      expect(calls.every(call => call.url.origin === api)).toBe(true);
    }

    expect(
      new URL(
        PayPalSSOApiPlugin({ ...creds, environment: "sandbox" }).getUrl(
          REQUEST,
        ),
      ).origin,
    ).toBe("https://www.sandbox.paypal.com");
    expect(() =>
      PayPalSSOApiPlugin({ ...creds, environment: "production" as never }),
    ).toThrow(/sandbox/);
  });

  it("PayPal: an unconfirmed primary email is not trusted", async () => {
    route({
      "https://api-m.paypal.com/v1/identity/oauth2/userinfo": {
        emails: [
          { confirmed: false, primary: true, value: "alice@paypal.test" },
        ],
        user_id: "u-1",
      },
      "https://api-m.paypal.com/v1/oauth2/token": {
        access_token: "at",
        token_type: "Bearer",
      },
    });

    expect(
      await signIn(PayPalSSOApiPlugin({ ...creds, environment: "live" })),
    ).toMatchObject({ emailVerified: false });
  });
});

describe("OpenID Connect providers", () => {
  const tokenAnswer = async (claims: Record<string, unknown>) => ({
    access_token: "at",
    id_token: await idToken(claims),
    ok: true,
    token_type: "Bearer",
  });

  it("Twitch: validates the ID token and drops an unverified email", async () => {
    const claims = {
      aud: "client",
      iss: "https://id.twitch.tv/oauth2",
      sub: "t-1",
    };
    route({
      "https://id.twitch.tv/oauth2/token": await tokenAnswer(claims),
      "https://id.twitch.tv/oauth2/userinfo": {
        email: "alice@twitch.test",
        email_verified: false,
        picture: "https://static-cdn.jtvnw.test/a.png",
        preferred_username: "alice",
        sub: "t-1",
      },
    });

    expect(await signIn(TwitchSSOApiPlugin(creds))).toEqual({
      avatarUrl: "https://static-cdn.jtvnw.test/a.png",
      email: "alice@twitch.test",
      emailVerified: false,
      id: "t-1",
      username: "alice",
    });

    route({
      "https://id.twitch.tv/oauth2/token": await tokenAnswer({
        ...claims,
        iss: "https://evil.test",
      }),
      "https://id.twitch.tv/oauth2/userinfo": { sub: "t-1" },
    });
    expect(await statusOf(signIn(TwitchSSOApiPlugin(creds)))).toBe(400);
  });

  it("Slack: keys accounts by workspace and user, and enforces a configured workspace", async () => {
    const claims = {
      aud: "client",
      email: "alice@acme.test",
      email_verified: true,
      family_name: "Smith",
      given_name: "Alice",
      "https://slack.com/team_id": "T0001",
      "https://slack.com/user_id": "U0001",
      iss: "https://slack.com",
      name: "Alice Smith",
      picture: "https://avatars.slack-edge.test/a.png",
      sub: "U0001",
    };
    route({
      "https://slack.com/api/openid.connect.token": await tokenAnswer(claims),
    });

    expect(await signIn(SlackSSOApiPlugin(creds))).toEqual({
      avatarUrl: "https://avatars.slack-edge.test/a.png",
      email: "alice@acme.test",
      emailVerified: true,
      firstName: "Alice",
      id: "T0001:U0001",
      lastName: "Smith",
      username: "Alice Smith",
    });

    const restricted = SlackSSOApiPlugin({ ...creds, teamId: "T0002" });
    expect(new URL(restricted.getUrl(REQUEST)).searchParams.get("team")).toBe(
      "T0002",
    );
    route({
      "https://slack.com/api/openid.connect.token": await tokenAnswer(claims),
    });
    expect(await statusOf(signIn(restricted))).toBe(403);
    expect(() => SlackSSOApiPlugin({ ...creds, teamId: "acme" })).toThrow(
      /teamId/,
    );
  });

  it("GitLab: isolates self-managed accounts from GitLab.com ones", async () => {
    const answer = async (issuer: string) =>
      route({
        [`${issuer}/oauth/token`]: await tokenAnswer({
          aud: "client",
          iss: issuer,
          sub: "42",
        }),
        [`${issuer}/oauth/userinfo`]: {
          email: "alice@gitlab.test",
          email_verified: true,
          given_name: "Alice",
          picture: "https://gitlab.test/a.png",
          sub: "42",
        },
      });

    await answer("https://gitlab.com");
    expect((await signIn(GitLabSSOApiPlugin(creds))).id).toBe("42");

    await answer("https://git.example.test");
    const selfManaged = GitLabSSOApiPlugin({
      ...creds,
      id: "gitlab-acme",
      issuer: "https://git.example.test/",
    });
    expect(await signIn(selfManaged)).toMatchObject({
      emailVerified: true,
      firstName: "Alice",
      id: "git.example.test:42",
    });
    expect(selfManaged.getUrl(REQUEST)).toContain(
      "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Flogin%2Fsso%2Fgitlab-acme",
    );

    // A token issued by another instance does not pass for this one.
    route({
      "https://git.example.test/oauth/token": await tokenAnswer({
        aud: "client",
        iss: "https://gitlab.com",
        sub: "42",
      }),
      "https://git.example.test/oauth/userinfo": { sub: "42" },
    });
    expect(await statusOf(signIn(selfManaged))).toBe(400);
  });

  it("GitLab: accepts only an HTTPS issuer (HTTP for localhost)", () => {
    expect(normalizeGitLabIssuer("https://git.example.test/gitlab/")).toBe(
      "https://git.example.test/gitlab",
    );
    expect(normalizeGitLabIssuer("http://localhost:8080")).toBe(
      "http://localhost:8080",
    );
    for (const bad of [
      "http://git.example.test",
      "https://git.example.test?x=1",
      "not a url",
    ]) {
      expect(() => normalizeGitLabIssuer(bad)).toThrow(/Invalid GitLab issuer/);
    }
    expect(() => GitLabSSOApiPlugin({ ...creds, id: "git lab" })).toThrow(
      /provider id/,
    );
  });

  describe("Microsoft", () => {
    const claims = (tid: string, extra: Record<string, unknown> = {}) => ({
      aud: "client",
      email: "alice@contoso.test",
      iss: `https://login.microsoftonline.com/${tid}/v2.0`,
      name: "Alice Smith",
      oid: "aaaaaaaa-0000-0000-0000-000000000001",
      sub: "pairwise-sub",
      tid,
      ...extra,
    });
    const answer = async (
      tenant: string,
      tokenClaims: Record<string, unknown>,
    ) =>
      route({
        [`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`]:
          await tokenAnswer(tokenClaims),
        "https://graph.microsoft.com/oidc/userinfo": {
          family_name: "Smith",
          given_name: "Alice",
          sub: "pairwise-sub",
        },
      });

    it("keys the account by tenant and object id, and trusts only a domain-verified email", async () => {
      await answer("common", claims(TENANT));
      expect(await signIn(MicrosoftSSOApiPlugin(creds))).toEqual({
        email: "alice@contoso.test",
        emailVerified: false,
        firstName: "Alice",
        id: `${TENANT}:aaaaaaaa-0000-0000-0000-000000000001`,
        lastName: "Smith",
        username: "Alice Smith",
      });

      await answer("common", claims(TENANT, { xms_edov: true }));
      expect(await signIn(MicrosoftSSOApiPlugin(creds))).toMatchObject({
        emailVerified: true,
      });
    });

    it("refuses an issuer that does not name the token's own tenant", async () => {
      await answer("common", {
        ...claims(TENANT),
        iss: "https://login.microsoftonline.com/common/v2.0",
      });

      expect(await statusOf(signIn(MicrosoftSSOApiPlugin(creds)))).toBe(400);
    });

    it("enforces the configured tenant on the token, not only in the URL", async () => {
      await answer("consumers", claims(TENANT));
      expect(
        await statusOf(
          signIn(MicrosoftSSOApiPlugin({ ...creds, tenant: "consumers" })),
        ),
      ).toBe(403);

      await answer("common", claims(TENANT));
      expect(
        await statusOf(
          signIn(
            MicrosoftSSOApiPlugin({
              ...creds,
              allowedTenantIds: ["99999999-2222-3333-4444-555555555555"],
            }),
          ),
        ),
      ).toBe(403);
    });

    it.each([
      ["common", TENANT, true],
      ["common", MICROSOFT_CONSUMERS_TENANT_ID, true],
      ["organizations", TENANT, true],
      ["organizations", MICROSOFT_CONSUMERS_TENANT_ID, false],
      ["consumers", MICROSOFT_CONSUMERS_TENANT_ID, true],
      ["consumers", TENANT, false],
      [TENANT, TENANT.toUpperCase(), true],
      [TENANT, MICROSOFT_CONSUMERS_TENANT_ID, false],
    ])("tenant %s accepts tid %s: %s", (tenant, tid, allowed) => {
      expect(microsoftTenantAllowed({ tenant, tid })).toBe(allowed);
    });

    it("refuses a tenant it cannot enforce", () => {
      expect(() =>
        MicrosoftSSOApiPlugin({ ...creds, tenant: "contoso.com" }),
      ).toThrow(/tenant/);
    });
  });

  describe("Apple", () => {
    const appleAdapter = () =>
      AppleSSOApiPlugin({
        clientId: "com.example.web",
        keyId: "ABCDEFGHIJ",
        privateKey: apple.pem,
        teamId: "TEAM123456",
      });
    const appleClaims = (extra: Record<string, unknown> = {}) => ({
      aud: "com.example.web",
      email: "abc@privaterelay.appleid.com",
      email_verified: "true",
      is_private_email: "true",
      iss: "https://appleid.apple.com",
      sub: "001234.abc",
      ...extra,
    });

    it("signs a client secret Apple accepts: ES256, Key ID, Team ID, Services ID", async () => {
      const { expiresAt, secret } = await createAppleClientSecret({
        clientId: "com.example.web",
        keyId: "ABCDEFGHIJ",
        now: new Date("2026-10-01T00:00:00Z"),
        privateKey: apple.pem,
        teamId: "TEAM123456",
      });
      const { payload } = await jwtVerify(secret, apple.publicKey, {
        currentDate: new Date("2026-10-01T00:00:00Z"),
      });

      expect(decodeProtectedHeader(secret)).toEqual({
        alg: "ES256",
        kid: "ABCDEFGHIJ",
      });
      expect(payload).toMatchObject({
        aud: "https://appleid.apple.com",
        iss: "TEAM123456",
        sub: "com.example.web",
      });
      expect(expiresAt - (payload.iat ?? 0)).toBeLessThanOrEqual(15_777_000);
    });

    it("reuses the client secret until it nears expiry, then renews it", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const adapter = appleAdapter();
      const calls = route({
        "https://appleid.apple.com/auth/token":
          await tokenAnswer(appleClaims()),
      });

      await adapter.fetchToken("c", CONTEXT);
      await adapter.fetchToken("c", CONTEXT);
      vi.setSystemTime(Date.now() + 23.5 * 60 * 60_000);
      await adapter.fetchToken("c", CONTEXT);
      vi.useRealTimers();

      const secrets = calls.map(call => call.body?.get("client_secret"));
      expect(secrets[0]).toBe(secrets[1]);
      expect(secrets[2]).not.toBe(secrets[0]);
    });

    it("trusts a verified relay email and takes the name from the first authorization only", async () => {
      route({
        "https://appleid.apple.com/auth/token":
          await tokenAnswer(appleClaims()),
      });
      const adapter = appleAdapter();
      const token = await adapter.fetchToken("c", CONTEXT);
      const first = await adapter.fetchUser(token, {
        ...CONTEXT,
        params: {
          user: JSON.stringify({
            name: { firstName: "Alice", lastName: "Smith" },
          }),
        },
      });
      const later = await adapter.fetchUser(token, CONTEXT);

      expect(first).toEqual({
        email: "abc@privaterelay.appleid.com",
        emailVerified: true,
        firstName: "Alice",
        id: "001234.abc",
        lastName: "Smith",
        username: "Alice Smith",
      });
      expect(later).toMatchObject({
        firstName: null,
        lastName: null,
        username: null,
      });
    });

    it("rejects an ID token for another Services ID or another attempt's nonce", async () => {
      for (const claims of [
        appleClaims({ aud: "com.other.web" }),
        appleClaims({ nonce: "nonce-2" }),
      ]) {
        route({
          "https://appleid.apple.com/auth/token": await tokenAnswer(claims),
        });

        expect(await statusOf(signIn(appleAdapter()))).toBe(400);
      }
    });

    it("does not trust an email Apple marks unverified", async () => {
      route({
        "https://appleid.apple.com/auth/token": await tokenAnswer(
          appleClaims({ email_verified: "false" }),
        ),
      });

      expect(await signIn(appleAdapter())).toMatchObject({
        emailVerified: false,
      });
    });
  });
});
