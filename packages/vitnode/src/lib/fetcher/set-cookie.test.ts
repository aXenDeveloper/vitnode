import { describe, expect, it } from "vitest";

import { parseSetCookies } from "./set-cookie";

describe("parseSetCookies", () => {
  it("parses the session cookie the API mints", () => {
    expect(
      parseSetCookies([
        "vitnode_auth=token-value; Path=/; Domain=localhost; Expires=Sun, 24 Nov 2026 10:00:00 GMT; HttpOnly; Secure",
      ]),
    ).toStrictEqual([
      {
        name: "vitnode_auth",
        options: {
          domain: "localhost",
          expires: new Date("Sun, 24 Nov 2026 10:00:00 GMT"),
          httpOnly: true,
          maxAge: undefined,
          path: "/",
          sameSite: undefined,
          secure: true,
        },
        value: "token-value",
      },
    ]);
  });

  it("parses every cookie in the response, not just the first", () => {
    expect(
      parseSetCookies([
        "vitnode_auth=a; Path=/",
        "vitnode_device=b; Path=/",
      ]).map(cookie => cookie.name),
    ).toStrictEqual(["vitnode_auth", "vitnode_device"]);
  });

  it("keeps each cookie's own attributes when a response sets several", () => {
    // One `Max-Age=0` in a response must not delete its neighbour, and one
    // persistent cookie must not keep the other alive.
    expect(
      parseSetCookies([
        "vitnode_auth=; Path=/; Max-Age=0",
        "vitnode_device=b; Path=/; Max-Age=31536000",
      ]).map(cookie => cookie.options.maxAge),
    ).toStrictEqual([0, 31536000]);
  });

  it("treats a cookie with no Expires as a session cookie", () => {
    expect(parseSetCookies(["vitnode_auth=a; Path=/"])[0].options.expires).toBe(
      undefined,
    );
  });

  it("drops an unparseable Expires instead of passing on an invalid date", () => {
    expect(
      parseSetCookies(["vitnode_auth=a; Expires=not-a-date"])[0].options
        .expires,
    ).toBe(undefined);
  });

  it("normalizes SameSite to the casing a cookie store expects", () => {
    expect(
      parseSetCookies(["vitnode_auth=a; SameSite=Lax"])[0].options.sameSite,
    ).toBe("lax");
    expect(
      parseSetCookies(["vitnode_auth=a; SameSite=Nonsense"])[0].options
        .sameSite,
    ).toBe(undefined);
  });

  it("reports httpOnly and secure as absent when the flags are not set", () => {
    expect(parseSetCookies(["vitnode_auth=a"])[0].options).toStrictEqual({
      domain: undefined,
      expires: undefined,
      httpOnly: false,
      maxAge: undefined,
      path: undefined,
      sameSite: undefined,
      secure: false,
    });
  });

  it("skips a header with no value to set", () => {
    expect(parseSetCookies(["HttpOnly"])).toStrictEqual([]);
  });

  it("returns nothing for a response that set no cookies", () => {
    expect(parseSetCookies([])).toStrictEqual([]);
  });

  describe("Max-Age", () => {
    it("carries a lifetime in seconds through", () => {
      expect(
        parseSetCookies(["vitnode_device=b; Path=/; Max-Age=31536000"])[0]
          .options.maxAge,
      ).toBe(31536000);
    });

    it("keeps Max-Age=0 rather than dropping it as falsy", () => {
      // The whole point of the attribute here: this is the header Hono's
      // `deleteCookie()` sends, so a `0` read as "absent" is a sign-out that
      // leaves the cookie in the browser.
      expect(
        parseSetCookies(["vitnode_auth=; Path=/; Max-Age=0"])[0].options.maxAge,
      ).toBe(0);
    });

    it("parses the sign-out header the API actually sends", () => {
      // Verbatim from `hono/cookie`'s `deleteCookie()`: an empty value, a
      // `Max-Age` of 0, and no `Expires` to fall back on.
      expect(
        parseSetCookies(["vitnode_auth=; Max-Age=0; Path=/"]),
      ).toStrictEqual([
        {
          name: "vitnode_auth",
          options: {
            domain: undefined,
            expires: undefined,
            httpOnly: false,
            maxAge: 0,
            path: "/",
            sameSite: undefined,
            secure: false,
          },
          value: "",
        },
      ]);
    });

    it("keeps a negative Max-Age, which also means delete now", () => {
      expect(
        parseSetCookies(["vitnode_auth=; Max-Age=-1"])[0].options.maxAge,
      ).toBe(-1);
    });

    it("ignores a Max-Age that is not a plain integer", () => {
      // `Number()` would read every one of these as a number and hand a cookie
      // store an attribute the API never sent.
      for (const header of [
        "vitnode_auth=a; Max-Age=",
        "vitnode_auth=a; Max-Age=soon",
        "vitnode_auth=a; Max-Age=1e3",
        "vitnode_auth=a; Max-Age=12.5",
        "vitnode_auth=a; Max-Age= 12",
      ]) {
        expect(parseSetCookies([header])[0].options.maxAge).toBe(undefined);
      }
    });

    it("ignores a bare Max-Age flag with no value", () => {
      expect(
        parseSetCookies(["vitnode_auth=a; Max-Age"])[0].options.maxAge,
      ).toBe(undefined);
    });

    it("forwards both Max-Age and Expires when the API sends both", () => {
      // Browsers give `Max-Age` precedence; dropping either here would only
      // lose what the API said.
      expect(
        parseSetCookies([
          "vitnode_auth=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
        ])[0].options,
      ).toMatchObject({
        expires: new Date(0),
        maxAge: 0,
      });
    });
  });

  describe("deletion", () => {
    it("reads an expired cookie as the deletion it is", () => {
      const [cookie] = parseSetCookies([
        "vitnode_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      ]);

      expect(cookie.value).toBe("");
      expect(cookie.options.expires).toStrictEqual(new Date(0));
    });

    it("keeps the empty value a deletion carries", () => {
      // `vitnode_auth=` splits to an empty string, not to a missing value - so
      // the cookie has to survive parsing rather than be skipped as unnamed.
      expect(parseSetCookies(["vitnode_auth=; Max-Age=0"])[0].value).toBe("");
    });
  });
});
