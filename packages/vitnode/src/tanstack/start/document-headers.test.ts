// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  applyDocumentCacheControl,
  applyRedirectCacheControl,
  DOCUMENT_CACHE_CONTROL,
} from "./document-headers";

/**
 * The one directive VitNode forces onto a response, and the two questions that
 * decide when.
 *
 * Both are content-type questions rather than path questions, which is the
 * property worth pinning: `/api/*` is served by the Hono bridge through the same
 * middleware, so a rule that keyed on anything else would quietly forbid clients
 * from caching the API.
 */

const html = (headers: Record<string, string> = {}) =>
  new Response("<!doctype html>", {
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });

describe("a rendered document", () => {
  it("is never offered to a shared cache", () => {
    const response = html();
    applyDocumentCacheControl(response);

    expect(response.headers.get("cache-control")).toBe(DOCUMENT_CACHE_CONTROL);
    expect(DOCUMENT_CACHE_CONTROL).toBe("private, no-store");
  });

  it("cannot opt out by setting its own directive", () => {
    // The invariant, not a default. A route is not in a position to know that
    // the dehydrated Query cache in its own body holds the visitor's session.
    const response = html({ "cache-control": "public, max-age=60" });
    applyDocumentCacheControl(response);

    expect(response.headers.get("cache-control")).toBe(DOCUMENT_CACHE_CONTROL);
  });

  it.each([
    "text/html",
    "text/html; charset=utf-8",
    "TEXT/HTML; charset=UTF-8",
  ])("is recognised from %s", contentType => {
    const response = new Response("", {
      headers: { "content-type": contentType },
    });
    applyDocumentCacheControl(response);

    expect(response.headers.get("cache-control")).toBe(DOCUMENT_CACHE_CONTROL);
  });
});

describe("everything that is not a document keeps what it had", () => {
  it("leaves an API response's own cache policy alone", () => {
    const response = new Response('{"ok":true}', {
      headers: {
        "cache-control": "public, max-age=300",
        "content-type": "application/json",
      },
    });
    applyDocumentCacheControl(response);

    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("adds nothing to an API response that said nothing", () => {
    const response = new Response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    });
    applyDocumentCacheControl(response);

    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("adds nothing to a response with no content type at all", () => {
    const response = new Response(null, { status: 204 });
    applyDocumentCacheControl(response);

    expect(response.headers.get("cache-control")).toBeNull();
  });
});

describe("a locale redirect", () => {
  it("stays cacheable while it carries no cookie", () => {
    // `/en/discover` -> `/discover` is a fact about URLs, identical for every
    // visitor, and permanently cacheable - which is most of the point of it.
    const response = new Response(null, {
      headers: {
        "cache-control": "public, max-age=31536000",
        location: "/discover",
      },
      status: 308,
    });
    applyRedirectCacheControl(response);

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000",
    );
  });

  it("is forced private the moment it writes a cookie", () => {
    // A stored copy would hand the next visitor through the same shared cache a
    // `Set-Cookie` somebody else chose, and switch their language.
    const response = new Response(null, {
      headers: {
        "cache-control": "public, max-age=31536000",
        location: "/admin",
        "set-cookie": "vitnode_locale=pl; Path=/",
      },
      status: 308,
    });
    applyRedirectCacheControl(response);

    expect(response.headers.get("cache-control")).toBe(DOCUMENT_CACHE_CONTROL);
  });
});
