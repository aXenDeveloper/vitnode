import { describe, expect, it } from "vitest";

import { browserHostOf, requestHostOf } from "./host";

const hostOf = (url: string, headers: Record<string, string> = {}) =>
  requestHostOf(new Request(url, { headers }));

describe("requestHostOf", () => {
  it("prefers the host a proxy forwarded", () => {
    expect(
      hostOf("http://127.0.0.1:3000/", {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "Vitnode.PL",
      }),
    ).toBe("vitnode.pl");
  });

  it("takes the first entry of a forwarded list", () => {
    expect(
      hostOf("http://127.0.0.1/", {
        "x-forwarded-host": "vitnode.pl, proxy.internal",
      }),
    ).toBe("vitnode.pl");
  });

  it("falls back to Host, then the request URL, past a malformed forwarded host", () => {
    expect(
      hostOf("http://127.0.0.1/", {
        host: "vitnode.com",
        "x-forwarded-host": "vitnode.pl/evil",
      }),
    ).toBe("vitnode.com");
    expect(hostOf("https://vitnode.pl:443/x")).toBe("vitnode.pl");
  });
});

describe("browserHostOf", () => {
  it("reads the address bar's host in the same form as the server", () => {
    expect(browserHostOf({ host: "vitnode.pl" })).toBe(
      hostOf("http://127.0.0.1/", { "x-forwarded-host": "vitnode.pl" }),
    );
  });

  it("answers undefined where there is no location", () => {
    expect(browserHostOf(undefined)).toBeUndefined();
  });
});
