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
});
