import { describe, expect, it } from "vitest";

import {
  LOCALE_COOKIE_NAME,
  readLocaleCookie,
  serializeLocaleCookie,
} from "./locale-cookie";

describe("readLocaleCookie", () => {
  it("reads the locale out of a cookie header", () => {
    expect(readLocaleCookie(`${LOCALE_COOKIE_NAME}=pl`)).toBe("pl");
  });

  it("finds it among other cookies, whatever the spacing", () => {
    expect(
      readLocaleCookie(`vitnode_auth=abc;${LOCALE_COOKIE_NAME}=pl; theme=dark`),
    ).toBe("pl");
  });

  it("does not match a cookie whose name merely ends the same way", () => {
    expect(readLocaleCookie(`not_${LOCALE_COOKIE_NAME}=pl`)).toBeUndefined();
  });

  it("returns nothing for an absent, empty or malformed cookie", () => {
    expect(readLocaleCookie(undefined)).toBeUndefined();
    expect(readLocaleCookie("")).toBeUndefined();
    expect(readLocaleCookie("theme=dark")).toBeUndefined();
    expect(readLocaleCookie(`${LOCALE_COOKIE_NAME}=`)).toBeUndefined();
    expect(readLocaleCookie(`${LOCALE_COOKIE_NAME}=%E0%A4%A`)).toBeUndefined();
  });

  it("decodes the value", () => {
    expect(readLocaleCookie(`${LOCALE_COOKIE_NAME}=pt%2DBR`)).toBe("pt-BR");
  });
});

describe("serializeLocaleCookie", () => {
  it("scopes the cookie to the whole site and survives inbound links", () => {
    const cookie = serializeLocaleCookie("pl");

    expect(cookie).toContain(`${LOCALE_COOKIE_NAME}=pl`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=");
  });

  it("adds Secure only when asked", () => {
    // A `Secure` cookie on `http://localhost` is dropped silently, taking the
    // remembered language with it.
    expect(serializeLocaleCookie("pl")).not.toContain("Secure");
    expect(serializeLocaleCookie("pl", { secure: true })).toContain("Secure");
  });

  it("round-trips through the reader", () => {
    const cookie = serializeLocaleCookie("pt-BR");

    expect(readLocaleCookie(cookie.split(";")[0])).toBe("pt-BR");
  });
});
