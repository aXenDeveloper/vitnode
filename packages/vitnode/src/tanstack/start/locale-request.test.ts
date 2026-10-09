import { describe, expect, it } from "vitest";

import { createLocaleRouting } from "@/lib/i18n/locale-routing";

import { resolveDocumentSecurityHeaders } from "./document-headers";
import { runLocaleRequest } from "./locale-request";

type Context = Parameters<typeof runLocaleRequest>[0];

const localeRouting = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en", "pl"],
});

const render = async (
  path: string,
  {
    headers = { "content-type": "text/html; charset=utf-8" },
    securityHeaders,
  }: {
    headers?: Record<string, string>;
    securityHeaders?: Record<string, string>;
  } = {},
): Promise<Headers> => {
  const response = new Response("<!doctype html>", { headers });
  const next = (async () =>
    await Promise.resolve({ response })) as unknown as Context["next"];

  const result = await runLocaleRequest(
    {
      handlerType: "router",
      next,
      request: new Request(`https://site.example${path}`),
    },
    localeRouting,
    securityHeaders,
  );

  return result instanceof Response
    ? result.headers
    : (result as { response: Response }).response.headers;
};

describe("document security headers", () => {
  it("sends the anti-clickjacking and hardening headers with a page", async () => {
    const headers = await render("/admin/core");

    expect(headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(headers.get("content-security-policy")).toBe(
      "frame-ancestors 'self'",
    );
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.has("strict-transport-security")).toBe(false);
  });

  it("leaves a response that is not HTML alone", async () => {
    const headers = await render("/sitemap.xml", {
      headers: { "content-type": "application/xml" },
    });

    expect(headers.has("x-frame-options")).toBe(false);
    expect(headers.has("content-security-policy")).toBe(false);
  });

  it("does not overwrite a header the route set itself", async () => {
    const headers = await render("/discover", {
      headers: {
        "content-security-policy": "frame-ancestors 'none'",
        "content-type": "text/html",
      },
    });

    expect(headers.get("content-security-policy")).toBe(
      "frame-ancestors 'none'",
    );
    expect(headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("applies an install's overrides", async () => {
    const headers = await render("/discover", {
      securityHeaders: resolveDocumentSecurityHeaders({
        "Strict-Transport-Security": "max-age=31536000",
        "X-Frame-Options": false,
      }),
    });

    expect(headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(headers.has("x-frame-options")).toBe(false);
    expect(headers.get("x-content-type-options")).toBe("nosniff");
  });
});
