// @vitest-environment node
import { describe, expect, it } from "vitest";

import { contentFailureResult, contentVersionOf } from "./api-result";
import { contentErrorKey } from "./mutation-feedback";

const body = (payload: unknown): string => JSON.stringify(payload);

const refusal = (status: number, payload: unknown) =>
  contentFailureResult({ error: body(payload), status });

describe("a version conflict", () => {
  it("is read out of the body rather than out of the status", () => {
    const result = refusal(409, {
      code: "CONTENT_VERSION_CONFLICT",
      contentTypeId: "blog.post",
      currentVersion: 7,
      expectedVersion: 6,
      itemId: 42,
    });

    expect(result.conflict?.code).toBe("CONTENT_VERSION_CONFLICT");
    expect(contentErrorKey(result.status, result)).toBe("version_conflict");
  });

  it("is told apart from a unique clash that shares its status", () => {
    const unique = refusal(409, {
      code: "CONTENT_UNIQUE_CONFLICT",
      contentTypeId: "blog.post",
      itemId: 42,
    });

    expect(unique.conflict?.code).not.toBe("CONTENT_VERSION_CONFLICT");
    expect(contentErrorKey(unique.status, unique)).toBe("unique_conflict");
  });
});

describe("the other structured refusals", () => {
  it("reads a reserved delivery address, and words it differently", () => {
    // A unique clash is "another record holds that address now"; a reservation
    // is "another record used to hold it and it still redirects there". Same
    // status, different sentence, possibly a different decision.
    const result = refusal(409, {
      code: "CONTENT_DELIVERY_SLUG_RESERVED",
      contentTypeId: "blog.post",
      locale: "en",
      slug: "hello",
    });

    expect(result.delivery?.code).toBe("CONTENT_DELIVERY_SLUG_RESERVED");
    expect(contentErrorKey(result.status, result)).toBe("slug_reserved");
  });

  it("reads a translation conflict into its own field", () => {
    const result = refusal(409, {
      code: "CONTENT_TRANSLATION_VERSION_CONFLICT",
      contentTypeId: "blog.post",
      currentVersion: 3,
      expectedVersion: 2,
      itemId: 42,
      locale: "pl",
    });

    expect(result.translationConflict?.locale).toBe("pl");
  });

  it("reads a schedule rejection into its own field", () => {
    const result = refusal(400, {
      code: "CONTENT_SCHEDULE_IN_PAST",
      contentTypeId: "blog.post",
    });

    expect(result.rejection?.code).toBe("CONTENT_SCHEDULE_IN_PAST");
  });

  it("reads a revision that no longer fits the schema", () => {
    const result = refusal(422, {
      code: "CONTENT_REVISION_NOT_RESTORABLE",
      contentTypeId: "blog.post",
      fields: ["subtitle"],
      revisionId: 12,
    });

    expect(result.unprocessable?.code).toBe("CONTENT_REVISION_NOT_RESTORABLE");
    expect(contentErrorKey(result.status, result)).toBe("not_restorable");
  });
});

describe("a refusal the API did not describe", () => {
  it.each([
    [400, "validation"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [422, "not_restorable"],
  ] as const)("falls back to the status for %i", (status, key) => {
    const result = contentFailureResult({ error: "", status });

    expect(result.conflict).toBeUndefined();
    expect(contentErrorKey(result.status, result)).toBe(key);
  });

  it("falls through to the generic server error for a 500", () => {
    // `null` is what a caller renders as "something went wrong", rather than
    // echoing a body nobody wrote for a person to read.
    const result = contentFailureResult({ error: "boom", status: 500 });

    expect(contentErrorKey(result.status, result)).toBeNull();
  });

  it("survives a body that is not JSON at all", () => {
    const result = contentFailureResult({
      error: "<html>502 Bad Gateway</html>",
      status: 502,
    });

    expect(result.conflict).toBeUndefined();
    expect(result.delivery).toBeUndefined();
    expect(contentErrorKey(result.status, result)).toBeNull();
  });

  it("always reports the status it was given", () => {
    // The panels branch on it, and a refusal that lost its status reads as a
    // success with no data.
    for (const status of [400, 403, 409, 422, 500, 503]) {
      expect(contentFailureResult({ error: "", status }).status).toBe(status);
    }
  });

  it("always carries a defined error, so `error === undefined` means success", () => {
    // The single check every caller makes. An absent body must still produce an
    // error, or a refusal reads as a write that worked.
    expect(contentFailureResult({ status: 500 }).error).toBe("");
  });
});

describe("the version a write leaves behind", () => {
  it("is read off the row when the content type has one", () => {
    expect(contentVersionOf({ id: 1, version: 4 })).toBe(4);
  });

  it("is absent for a content type with no editorial layer", () => {
    // Not `0` and not `1`: there is no version to send, and inventing one would
    // make a precondition out of a guess.
    expect(contentVersionOf({ id: 1 })).toBeUndefined();
    expect(contentVersionOf()).toBeUndefined();
  });

  it("ignores a version that is not a number", () => {
    expect(contentVersionOf({ id: 1, version: "4" })).toBeUndefined();
  });
});
