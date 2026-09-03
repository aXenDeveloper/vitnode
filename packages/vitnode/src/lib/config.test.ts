import { afterEach, describe, expect, it, vi } from "vitest";

import { CONFIG } from "./config";

const inBrowserAt = <T>(origin: string | undefined, read: () => T): T => {
  vi.stubGlobal("location", origin === undefined ? undefined : { origin });

  try {
    return read();
  } finally {
    vi.unstubAllGlobals();
  }
};

describe("CONFIG.api", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is the configured origin when there is one", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");

    expect(
      inBrowserAt("https://web.example.com", () => CONFIG.api.origin),
    ).toBe("https://api.example.com");
  });

  it("is the page's own origin in a browser when nothing is configured", () => {
    // The mount is same-origin - this app serves `/api/*` itself - so the
    // browser already knows the answer and no environment variable has to.
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);

    expect(inBrowserAt("https://vitnode.com", () => CONFIG.api.origin)).toBe(
      "https://vitnode.com",
    );
  });

  it("works on a hostname nobody could have configured", () => {
    // A preview deployment: the URL is generated per branch, so the old
    // `http://localhost:3000` default pointed every visitor's browser at their
    // own machine.
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);

    expect(
      inBrowserAt(
        "https://web-git-feat-abc123.vercel.app",
        () => CONFIG.api.origin,
      ),
    ).toBe("https://web-git-feat-abc123.vercel.app");
  });

  it("keeps the configured origin ahead of the page's own", () => {
    // A genuinely separate API server stays reachable: same-origin is the
    // default, not a hard-coding.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");

    expect(
      inBrowserAt("https://web-git-feat-abc123.vercel.app", () =>
        CONFIG.api.toString(),
      ),
    ).toBe("https://api.example.com/");
  });

  it("falls back to localhost off a document, where there is no origin to read", () => {
    // Node: the API server, a script, a build. Nothing to read, so the
    // configured value - or its default - is all there is.
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);

    expect(inBrowserAt(undefined, () => CONFIG.api.origin)).toBe(
      "http://localhost:3000",
    );
  });

  it("ignores an opaque origin rather than throwing on it", () => {
    // A sandboxed iframe reports the string `"null"`, which `new URL()` would
    // reject - and a throw here takes the whole render with it.
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);

    expect(inBrowserAt("null", () => CONFIG.api.origin)).toBe(
      "http://localhost:3000",
    );
  });

  it("still throws on an empty NEXT_PUBLIC_API_URL", () => {
    // Set-but-broken is a deployment mistake to surface, not an absence to
    // paper over: `contentPreviewConfigProblems` reads this throw to report it.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    expect(() =>
      inBrowserAt("https://vitnode.com", () => CONFIG.api),
    ).toThrow();
  });
});
