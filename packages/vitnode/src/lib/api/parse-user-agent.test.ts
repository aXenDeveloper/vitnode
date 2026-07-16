import { describe, expect, it } from "vitest";

import { parseUserAgent } from "./parse-user-agent";

describe("parseUserAgent", () => {
  it("parses macOS Chrome (desktop)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    expect(parseUserAgent(ua)).toEqual({
      browser: "Chrome 125.0.0.0",
      deviceType: "desktop",
      os: "Mac OS",
    });
  });

  it("parses Windows Edge (desktop)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";

    expect(parseUserAgent(ua)).toEqual({
      browser: "Edge 120.0.0.0",
      deviceType: "desktop",
      os: "Windows",
    });
  });

  it("parses iPhone Safari (mobile)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

    expect(parseUserAgent(ua)).toEqual({
      browser: "Safari 17.5",
      deviceType: "mobile",
      os: "iOS",
    });
  });

  it("parses iPad Safari (tablet)", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1";

    expect(parseUserAgent(ua)).toEqual({
      browser: "Safari 17.5",
      deviceType: "tablet",
      os: "iOS",
    });
  });

  it("parses Android Chrome (mobile)", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

    expect(parseUserAgent(ua)).toEqual({
      browser: "Chrome 125.0.0.0",
      deviceType: "mobile",
      os: "Android",
    });
  });

  it("parses Android Chrome without Mobile token (tablet)", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    expect(parseUserAgent(ua)).toEqual({
      browser: "Chrome 125.0.0.0",
      deviceType: "tablet",
      os: "Android",
    });
  });

  it("parses Linux Firefox (desktop)", () => {
    const ua =
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0";

    expect(parseUserAgent(ua)).toEqual({
      browser: "Firefox 126.0",
      deviceType: "desktop",
      os: "Ubuntu",
    });
  });

  it("falls back to Unknown for empty, node, or garbage input", () => {
    const fallback = {
      browser: "Unknown",
      deviceType: "desktop",
      os: "Unknown",
    };

    expect(parseUserAgent("")).toEqual(fallback);
    expect(parseUserAgent(null)).toEqual(fallback);
    expect(parseUserAgent(undefined)).toEqual(fallback);
    expect(parseUserAgent("node")).toEqual(fallback);
    expect(parseUserAgent("!!!not-a-user-agent!!!")).toEqual(fallback);
  });
});
