import { describe, expect, it } from "vitest";

import { browserHostOf, requestHostOf } from "./host";

const hostOf = (url: string, headers: Record<string, string> = {}) =>
  requestHostOf(new Request(url, { headers }));

describe("requestHostOf", () => {
  it("reads the host the request was addressed to", () => {
    expect(hostOf("https://VitNode.PL/x")).toBe("vitnode.pl");
    expect(hostOf("https://vitnode.pl:443/x")).toBe("vitnode.pl");
    expect(hostOf("http://localhost:3000/x")).toBe("localhost:3000");
  });

  it("ignores an X-Forwarded-Host the client could have sent itself", () => {
    expect(
      hostOf("https://vitnode.com/discover", {
        "x-forwarded-host": "vitnode.pl",
      }),
    ).toBe("vitnode.com");
    expect(
      hostOf("http://127.0.0.1:3000/discover", {
        "x-forwarded-host": "vitnode.pl",
      }),
    ).toBe("127.0.0.1:3000");
  });
});

describe("browserHostOf", () => {
  it("reads the address bar's host in the same form as the server", () => {
    expect(browserHostOf({ host: "vitnode.pl" })).toBe(
      hostOf("https://vitnode.pl/discover"),
    );
  });

  it("agrees with the server when a client forges X-Forwarded-Host", () => {
    expect(browserHostOf({ host: "vitnode.com" })).toBe(
      hostOf("https://vitnode.com/discover", {
        "x-forwarded-host": "vitnode.pl",
      }),
    );
  });

  it("answers undefined where there is no location", () => {
    expect(browserHostOf(undefined)).toBeUndefined();
  });
});
