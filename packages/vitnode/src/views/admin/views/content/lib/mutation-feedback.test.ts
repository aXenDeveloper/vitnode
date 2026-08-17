import { describe, expect, it } from "vitest";

import { contentErrorKey } from "./mutation-feedback";

describe("contentErrorKey", () => {
  it.each([
    [400, "validation"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
  ])("maps %i to the %s message", (status, key) => {
    expect(contentErrorKey(status)).toBe(key);
  });

  it("tells a restricted delete apart from a server fault", () => {
    // The whole point: a 409 is explainable, a 500 is not, and they must never
    // read the same.
    expect(contentErrorKey(409)).not.toBe(contentErrorKey(500));
  });

  it("falls through to the generic message for anything unrecognised", () => {
    expect(contentErrorKey(500)).toBeNull();
    expect(contentErrorKey(502)).toBeNull();
    expect(contentErrorKey(undefined)).toBeNull();
  });

  describe("structured editorial errors", () => {
    it("separates a lost update from a taken value", () => {
      // Both are 409, and they need different words *and* different buttons -
      // which is the reason the code exists at all.
      const version = contentErrorKey(409, {
        conflict: {
          code: "CONTENT_VERSION_CONFLICT",
          contentTypeId: "test.editorial",
          currentVersion: 9,
          expectedVersion: 4,
          itemId: 7,
        },
      });
      const unique = contentErrorKey(409, {
        conflict: {
          code: "CONTENT_UNIQUE_CONFLICT",
          contentTypeId: "test.editorial",
          itemId: 7,
        },
      });

      expect(version).toBe("version_conflict");
      expect(unique).toBe("unique_conflict");
      expect(version).not.toBe(unique);
    });

    it("maps an unrestorable revision", () => {
      expect(
        contentErrorKey(422, {
          unprocessable: {
            code: "CONTENT_REVISION_NOT_RESTORABLE",
            contentTypeId: "test.editorial",
            fields: ["title"],
            revisionId: 3,
          },
        }),
      ).toBe("not_restorable");
    });

    it("still handles a 422 with no body", () => {
      expect(contentErrorKey(422)).toBe("not_restorable");
    });

    it("leaves a plain-text 409 on the old message", () => {
      // A Stage 1-3 route sends no JSON body, and its 409 still means "still
      // referenced by other content".
      expect(contentErrorKey(409, {})).toBe("conflict");
    });
  });
});
