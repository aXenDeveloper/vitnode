import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeSsoProfile } from "@/api/lib/sso-profile";

import { DiscordSSOApiPlugin } from "./discord";
import { FACEBOOK_GRAPH_VERSION, FacebookSSOApiPlugin } from "./facebook";
import { GoogleSSOApiPlugin } from "./google";

const credentials = { clientId: "client", clientSecret: "secret" };

const TOKEN = { access_token: "token", token_type: "Bearer" };

const CONTEXT = { codeVerifier: "verifier", nonce: "nonce", params: {} };

const answer = (body: unknown) => {
  const fetch = vi.fn(async (_input: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 })),
  );
  vi.stubGlobal("fetch", fetch);

  return fetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Google adapter", () => {
  const google = GoogleSSOApiPlugin(credentials);

  it("returns the picture, given name and family name", async () => {
    answer({
      email: "alice@gmail.test",
      family_name: "Smith",
      given_name: "Alice",
      id: "123",
      name: "Alice Smith",
      picture: "https://lh3.googleusercontent.com/a/photo=s96-c",
      verified_email: true,
    });

    expect(await google.fetchUser(TOKEN, CONTEXT)).toEqual({
      avatarUrl: "https://lh3.googleusercontent.com/a/photo=s96-c",
      email: "alice@gmail.test",
      emailVerified: true,
      firstName: "Alice",
      id: "123",
      lastName: "Smith",
      username: "Alice Smith",
    });
  });

  it("treats a missing given or family name as absent, never splitting the full name", async () => {
    answer({
      email: "alice@gmail.test",
      id: "123",
      name: "Alice Smith",
      verified_email: true,
    });

    expect(await google.fetchUser(TOKEN, CONTEXT)).toMatchObject({
      avatarUrl: null,
      firstName: null,
      lastName: null,
    });
  });
});

describe("the Discord adapter", () => {
  const discord = DiscordSSOApiPlugin(credentials);

  it("builds the CDN avatar URL from the avatar hash", async () => {
    answer({
      avatar: "a_1269e74af4df7417b13759eae50c83dc",
      email: "alice@discord.test",
      global_name: "Alice Smith",
      id: "80351110224678912",
      username: "alice",
      verified: true,
    });

    expect(await discord.fetchUser(TOKEN, CONTEXT)).toEqual({
      avatarUrl:
        "https://cdn.discordapp.com/avatars/80351110224678912/a_1269e74af4df7417b13759eae50c83dc.png?size=512",
      email: "alice@discord.test",
      emailVerified: true,
      id: "80351110224678912",
      username: "alice",
    });
  });

  it("reports no avatar for a default one, or a hash it cannot trust", async () => {
    for (const avatar of [null, "../../evil", undefined]) {
      answer({
        avatar,
        email: "alice@discord.test",
        id: "80351110224678912",
        username: "alice",
        verified: true,
      });

      expect((await discord.fetchUser(TOKEN, CONTEXT)).avatarUrl).toBeNull();
    }
  });
});

describe("the Facebook adapter", () => {
  const facebook = FacebookSSOApiPlugin(credentials);

  it("requests the separate name fields and the picture from the current Graph API", async () => {
    const fetch = answer({
      email: "alice@facebook.test",
      first_name: "Alice",
      id: "10",
      last_name: "Smith",
      name: "Alice Smith",
      picture: {
        data: {
          is_silhouette: false,
          url: "https://platform-lookaside.fbsbx.com/photo.jpg",
        },
      },
    });

    expect(await facebook.fetchUser(TOKEN, CONTEXT)).toEqual({
      avatarUrl: "https://platform-lookaside.fbsbx.com/photo.jpg",
      email: "alice@facebook.test",
      emailVerified: true,
      firstName: "Alice",
      id: "10",
      lastName: "Smith",
      username: "Alice Smith",
    });

    const requested = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe(`/${FACEBOOK_GRAPH_VERSION}/me`);
    expect(requested.searchParams.get("fields")).toContain("first_name");
    expect(requested.searchParams.get("fields")).toContain("last_name");
    expect(requested.searchParams.get("fields")).toContain("is_silhouette");
  });

  it("treats the default silhouette as no avatar", async () => {
    answer({
      email: "alice@facebook.test",
      id: "10",
      name: "Alice Smith",
      picture: { data: { is_silhouette: true, url: "https://x.test/s.jpg" } },
    });

    expect(await facebook.fetchUser(TOKEN, CONTEXT)).toMatchObject({
      avatarUrl: null,
      firstName: null,
      lastName: null,
    });
  });
});

describe("normalizing what an adapter returns", () => {
  const everything = {
    profileFields: ["avatar", "firstName", "lastName"] as const,
  };

  it("keeps only https avatar URLs", () => {
    for (const avatarUrl of [
      "http://example.test/a.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
    ]) {
      expect(
        normalizeSsoProfile(everything, { avatarUrl }).avatarUrl,
      ).toBeNull();
    }
  });

  it("drops empty and over-long names instead of storing them", () => {
    expect(
      normalizeSsoProfile(everything, {
        firstName: "  ",
        lastName: "x".repeat(500),
      }),
    ).toEqual({ avatarUrl: null, firstName: null, lastName: null });
  });

  it("ignores everything from an adapter that declares no profile fields", () => {
    expect(
      normalizeSsoProfile(
        {},
        {
          avatarUrl: "https://example.test/a.png",
          firstName: "Alice",
          lastName: "Smith",
        },
      ),
    ).toEqual({ avatarUrl: null, firstName: null, lastName: null });
  });
});
