// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetches: { formData?: FormData; method: string; path?: string }[] = [];
let next: (() => Promise<Response>) | null = null;

/**
 * The real `rawApiFetch`, minus the network - including the one behaviour that
 * shaped this suite: it **throws** on a 500 rather than returning, and its
 * message carries the response body after a newline.
 */
vi.mock("../../lib/fetcher/raw", () => ({
  rawApiFetch: async ({
    formData,
    method,
    path,
  }: {
    formData?: FormData;
    method: string;
    path?: string;
  }) => {
    fetches.push({ formData, method, path });
    const response = await (next?.() ??
      Promise.resolve(new Response(null, { status: 200 })));

    if (response.status === 500) {
      const text = await response.text();
      throw new Error(
        `500 - http://localhost:3000/api/x\n${text.trim() === "" ? response.statusText : text}`,
      );
    }

    return response;
  },
}));

const { ContentUploadError, uploadContentFile } = await import("./upload");

const SPEC = { permissionModule: "posts", pluginId: "@vitnode/blog" };

const upload = async () =>
  await uploadContentFile({
    field: "coverImage",
    file: new File([new Uint8Array(8)], "hero.png", { type: "image/png" }),
    spec: SPEC,
  });

const failing = (
  body: BodyInit | null,
  status: number,
  headers?: Record<string, string>,
) => {
  next = async () =>
    await Promise.resolve(new Response(body, { headers, status }));
};

const rejection = async (): Promise<
  InstanceType<typeof ContentUploadError>
> => {
  const error = await upload().then(
    () => null,
    (thrown: unknown) => thrown,
  );

  expect(error).toBeInstanceOf(ContentUploadError);

  return error as InstanceType<typeof ContentUploadError>;
};

const json = (body: unknown, status: number) =>
  failing(JSON.stringify(body), status, {
    "content-type": "application/json",
  });

beforeEach(() => {
  fetches.length = 0;
  next = null;
});

describe("a successful upload", () => {
  it("posts multipart to the field's own route and parses the descriptor", async () => {
    json(
      {
        height: 900,
        id: 42,
        mimeType: "image/webp",
        name: "hero.webp",
        size: 1024,
        url: "https://cdn.test/hero.webp",
        width: 1600,
      },
      200,
    );

    const descriptor = await upload();

    expect(descriptor).toMatchObject({ id: 42, name: "hero.webp" });
    expect(fetches[0]).toMatchObject({
      method: "post",
      path: "/uploads/coverImage",
    });
    expect(fetches[0].formData?.get("file")).toBeInstanceOf(File);
  });
});

/**
 * Why this suite exists.
 *
 * The first version read the body with `response.json()` and fell back to "The
 * upload failed. Please try again." for anything else. Hono renders an
 * `HTTPException`'s message as **plain text**, so every guard outside the route's
 * own body - the storage adapter, the image pipeline, rate limiting, the admin
 * session gate - arrived as text, failed the JSON parse, and was replaced by a
 * sentence that told the person nothing and invited them to retry a
 * misconfiguration.
 */
describe("what a refused upload says", () => {
  it("uses the route's own JSON rejection, code included", async () => {
    json(
      {
        code: "CONTENT_FILE_TOO_LARGE",
        message: "This file is 9 MB. The maximum is 5 MB.",
      },
      400,
    );

    const error = await rejection();

    expect(error.code).toBe("CONTENT_FILE_TOO_LARGE");
    expect(error.message).toBe("This file is 9 MB. The maximum is 5 MB.");
  });

  it("marks the three rules the uploader can restate in the reader's language", async () => {
    for (const [code, reason] of [
      ["CONTENT_FILE_TOO_LARGE", "size"],
      ["CONTENT_FILE_MIME_TYPE_NOT_ALLOWED", "mimeType"],
      ["CONTENT_FILE_EXTENSION_NOT_ALLOWED", "extension"],
    ] as const) {
      json({ code, message: "…" }, 400);

      expect((await rejection()).reason).toBe(reason);
    }
  });

  it("leaves everything else for the server's own words", async () => {
    // Nothing the browser could say about these is an improvement.
    for (const code of [
      "CONTENT_FILE_STORAGE_UNAVAILABLE",
      "CONTENT_FILE_INVALID",
      "CONTENT_FILE_FORBIDDEN",
      "CONTENT_FILE_FIELD_UNKNOWN",
    ]) {
      json({ code, message: "Storage provider not found" }, 400);

      const error = await rejection();
      expect(error.reason).toBeUndefined();
      expect(error.message).toBe("Storage provider not found");
    }
  });

  it("reads a plain-text HTTPException message", async () => {
    // The case that produced the generic sentence.
    failing("Invalid or corrupt image file", 400);

    const error = await rejection();

    expect(error.message).toBe("Invalid or corrupt image file");
    expect(error.message).not.toMatch(/try again/i);
  });

  it("reads the `error` key the core middleware answers with", async () => {
    json({ error: "Too many requests" }, 429);

    expect((await rejection()).message).toBe("Too many requests");
  });

  it("says the platform refused an oversized body on a 413", async () => {
    // No `maxBytes` check ran - the body never reached the route - so there is
    // no JSON to read and the status is the only fact available.
    failing(null, 413);

    expect((await rejection()).message).toMatch(/too large/i);
  });

  it("names the session and the permission cases", async () => {
    failing(null, 401);
    expect((await rejection()).message).toMatch(/session/i);

    failing(null, 403);
    expect((await rejection()).message).toMatch(/permission/i);
  });

  it("points at the storage configuration on a 5xx with no body", async () => {
    failing(null, 502);

    expect((await rejection()).message).toMatch(/storage adapter/i);
  });

  it("surfaces the body of a 500, which the fetcher throws rather than returns", async () => {
    failing("Storage provider not found", 500);

    const error = await rejection();

    expect(error.message).toBe("Storage provider not found");
    // Not the URL the fetcher prefixes its throw with.
    expect(error.message).not.toContain("http://");
  });

  it("does not show a proxy's HTML error page", async () => {
    failing("<!doctype html><html><body>502 Bad Gateway</body></html>", 502);

    const error = await rejection();

    expect(error.message).not.toContain("<");
    expect(error.message).toMatch(/storage adapter/i);
  });

  it("clamps a message longer than it needs to be", async () => {
    failing(`Boom: ${"x".repeat(900)}`, 400);

    const error = await rejection();

    expect(error.message.length).toBeLessThanOrEqual(401);
    expect(error.message.endsWith("…")).toBe(true);
    expect(error.message.startsWith("Boom:")).toBe(true);
  });

  it("ignores a body far too long to be a message at all", async () => {
    // Kilobytes of text is a stack trace or a dumped page, not a sentence
    // somebody wrote for this moment - so the status is the more honest answer.
    failing("x".repeat(5000), 400);

    expect((await rejection()).message).toMatch(/HTTP 400/);
  });

  it("falls back to the status only when the body is empty", async () => {
    failing("", 400);

    expect((await rejection()).message).toMatch(/HTTP 400/);
  });
});
