// @vitest-environment node
import type { Context } from "hono";

import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { EnvVariablesVitNode } from "@/api/middlewares/global.middleware";

import { parseSetCookies } from "@/lib/fetcher/set-cookie";

import { deleteAuthCookie, setAuthCookie } from "./auth-cookie";

type Authorization = EnvVariablesVitNode["core"]["authorization"];

const COOKIE = "vitnode_auth";

/**
 * The `core` context these helpers read, with only the two fields they touch.
 *
 * Cast once, here: `ContextVariableMap` is augmented globally so `c.set("core")`
 * wants the whole registry - plugins, content models, the cron metadata - none
 * of which a cookie attribute depends on.
 */
const coreWith = (
  authorization: Partial<Authorization>,
): EnvVariablesVitNode["core"] =>
  ({
    authorization: { cookieSecure: true, ...authorization },
  }) as EnvVariablesVitNode["core"];

/**
 * The `Set-Cookie` headers a request to `url` comes back with, once `write` has
 * run against a real Hono response. Asserting the header rather than the options
 * object is the point: it is what a browser would actually be handed.
 */
const setCookiesFrom = ({
  authorization = {},
  url = "https://vitnode.com/api/@vitnode/core/users/sign_in",
  write,
}: {
  authorization?: Partial<Authorization>;
  url?: string;
  write: (c: Context) => void;
}): string[] => {
  const app = new Hono();

  app.all("*", c => {
    c.set("core", coreWith(authorization));
    write(c);

    return c.body(null, 204);
  });

  // `app.request` is synchronous enough here: the handler never awaits.
  const response = app.request(url);

  if (!(response instanceof Response)) {
    throw new Error("expected a synchronous response");
  }

  return response.headers.getSetCookie();
};

const write = (c: Context) => {
  setAuthCookie(c, COOKIE, "token-value", {
    expires: new Date("2027-01-01T00:00:00Z"),
  });
};

const remove = (c: Context) => {
  deleteAuthCookie(c, COOKIE);
};

describe("setAuthCookie", () => {
  describe("host-only by default", () => {
    // Every host VitNode is served from, including the one nobody configured.
    it.each([
      ["localhost", "http://localhost:3001/api/x"],
      ["a production hostname", "https://vitnode.com/api/x"],
      [
        "a generated preview hostname",
        "https://web-git-feat-tanstack-abc123.vercel.app/api/x",
      ],
    ])("sends no Domain on %s", (_label, url) => {
      const [cookie] = setCookiesFrom({ url, write });

      // A `Domain` naming anything the response did not come from is rejected
      // outright, so the visitor is never signed in at all.
      expect(cookie).not.toContain("Domain");
      expect(parseSetCookies([cookie])[0].options.domain).toBe(undefined);
    });

    it("still pins the path so a deletion can match it", () => {
      expect(parseSetCookies(setCookiesFrom({ write }))[0].options.path).toBe(
        "/",
      );
    });

    it("keeps the cookie unreadable to scripts and https-only", () => {
      expect(
        parseSetCookies(setCookiesFrom({ write }))[0].options,
      ).toMatchObject({ httpOnly: true, secure: true });
    });

    it("honours cookieSecure for a plain-http install", () => {
      expect(
        parseSetCookies(
          setCookiesFrom({ authorization: { cookieSecure: false }, write }),
        )[0].options.secure,
      ).toBe(false);
    });

    it("writes a session cookie when no expiry is given", () => {
      // The SSO state cookie: good for one round trip, not for a year.
      const [cookie] = setCookiesFrom({
        write: c => {
          setAuthCookie(c, COOKIE, "state");
        },
      });

      expect(cookie).not.toContain("Expires");
    });
  });

  describe("explicit cookieDomain", () => {
    it("emits the Domain an install asked for", () => {
      const [cookie] = setCookiesFrom({
        authorization: { cookieDomain: ".example.com" },
        url: "https://app.example.com/api/x",
        write,
      });

      expect(parseSetCookies([cookie])[0].options.domain).toBe(".example.com");
      expect(cookie).toContain("Domain=.example.com");
    });

    it("is opt-in, not derived from anything", () => {
      // The regression this closes: a domain guessed from `NEXT_PUBLIC_WEB_URL`
      // is `localhost` in development and the production domain on a preview
      // deployment - wrong in both places, and silent.
      expect(
        setCookiesFrom({ url: "https://app.example.com/api/x", write })[0],
      ).not.toContain("Domain");
    });
  });
});

describe("deleteAuthCookie", () => {
  /** A cookie is identified by name, domain and path; a deletion must match all three. */
  const domainAndPath = (header: string) => {
    const [{ options }] = parseSetCookies([header]);

    return { domain: options.domain, path: options.path };
  };

  it("targets the same cookie the write created, host-only", () => {
    const [created] = setCookiesFrom({ write });
    const [deleted] = setCookiesFrom({ write: remove });

    expect(domainAndPath(deleted)).toStrictEqual(domainAndPath(created));
    expect(deleted).not.toContain("Domain");
  });

  it("targets the same cookie the write created, with an explicit domain", () => {
    const authorization = { cookieDomain: ".example.com" };
    const [created] = setCookiesFrom({ authorization, write });
    const [deleted] = setCookiesFrom({ authorization, write: remove });

    // The bug this closes: sign-out used to send no `Domain` against a cookie
    // created with one, which removes nothing and reports nothing.
    expect(domainAndPath(deleted)).toStrictEqual(domainAndPath(created));
    expect(domainAndPath(deleted).domain).toBe(".example.com");
  });

  it("expires the cookie rather than merely blanking it", () => {
    const [{ options, value }] = parseSetCookies(
      setCookiesFrom({ write: remove }),
    );

    expect(value).toBe("");
    expect(options.maxAge).toBe(0);
  });

  it("deletes on every host the same way it creates", () => {
    for (const url of [
      "http://localhost:3001/api/x",
      "https://vitnode.com/api/x",
      "https://web-git-feat-tanstack-abc123.vercel.app/api/x",
    ]) {
      expect(
        domainAndPath(setCookiesFrom({ url, write: remove })[0]),
      ).toStrictEqual(domainAndPath(setCookiesFrom({ url, write })[0]));
    }
  });
});
