// @vitest-environment node
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  ContentAdvancedInputError,
  ContentDefaultTranslationRequired,
  ContentInputError,
  ContentLanguageError,
  ContentRevisionNotRestorable,
  ContentScheduleError,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
  ContentVersionConflict,
} from "../errors";
import { withHttpErrors } from "./http-errors";
import { withTranslationHttpErrors } from "./translation-http-errors";

/**
 * What a client is allowed to learn when a write fails.
 *
 * Two rules, and the second is the one that needs a test rather than a comment:
 *
 * 1. **Every expected failure has a stable contract** - a status, and for the
 *    ones a client has to branch on, a `code`. A caller cannot be asked to parse
 *    English, and it certainly cannot be asked to parse a SQLSTATE.
 * 2. **Nothing internal crosses the boundary.** A driver error carries the
 *    constraint name, often the column, and sometimes the value that clashed.
 *    None of that may reach a response body - it is a schema description handed
 *    to whoever asked, and on a public route it is handed to anyone.
 */

const CONTENT_TYPE_ID = "test.article";

/** The whole response, as a client would see it. */
const responseOf = async (
  run: () => Promise<unknown>,
  options: Parameters<typeof withHttpErrors>[2] = {},
): Promise<{ body: string; status: number }> => {
  try {
    await withHttpErrors("update", run, {
      contentTypeId: CONTENT_TYPE_ID,
      ...options,
    });
  } catch (error) {
    if (!(error instanceof HTTPException)) throw error;

    const res = error.getResponse();

    return { body: await res.text(), status: res.status };
  }

  throw new Error("Expected the write to fail.");
};

const translationResponseOf = async (
  run: () => Promise<unknown>,
  action: "create" | "delete" | "read" | "update" = "update",
): Promise<{ body: string; status: number }> => {
  try {
    await withTranslationHttpErrors(action, run, {
      contentTypeId: CONTENT_TYPE_ID,
      itemId: 7,
      locale: "pl",
    });
  } catch (error) {
    if (!(error instanceof HTTPException)) throw error;

    const res = error.getResponse();

    return { body: await res.text(), status: res.status };
  }

  throw new Error("Expected the translation write to fail.");
};

/** A driver failure, in the shape Drizzle actually wraps one in. */
const driverError = (code: string, detail: string) =>
  Object.assign(new Error("Failed query: insert into ..."), {
    cause: Object.assign(new Error(detail), {
      code,
      constraint_name: "example_articles_code_key",
      detail,
      schema_name: "public",
      table_name: "example_articles",
    }),
  });

const throwing = (error: unknown) => async () => {
  await Promise.resolve();
  throw error;
};

describe("expected database failures map onto stable contracts", () => {
  it.each([
    ["23505", 409, "unique violation"],
    ["23503", 400, "foreign key violation on a write"],
    ["23502", 400, "not-null violation"],
    ["23001", 409, "restrict violation"],
  ])("turns %s into %i (%s)", async (code, status) => {
    const result = await responseOf(
      throwing(driverError(code, "Key (code)=(guide-001) already exists.")),
    );

    expect(result.status).toBe(status);
  });

  it("reads the SQLSTATE through the wrapper Drizzle puts around it", async () => {
    // `DrizzleQueryError.code` is undefined and the real error is on `cause`, so
    // a mapper reading `error.code` alone would turn every constraint failure
    // into a 500.
    const bare = Object.assign(new Error("duplicate"), { code: "23505" });

    await expect(responseOf(throwing(bare))).resolves.toMatchObject({
      status: 409,
    });
  });

  it("answers a delete blocked by a reference with 409, not 400", async () => {
    // The same SQLSTATE means different things by verb: on a create it is "the
    // thing you pointed at is gone", on a delete it is "something still points
    // at this".
    try {
      await withHttpErrors(
        "delete",
        throwing(driverError("23503", "still referenced")),
        { contentTypeId: CONTENT_TYPE_ID },
      );
    } catch (error) {
      expect((error as HTTPException).status).toBe(409);
    }
  });

  /**
   * Postgres 18 reports an explicit `ON DELETE RESTRICT` as `23001`
   * (restrict_violation) where earlier majors reported `23503`. Both have to map
   * to the same 409, or upgrading the database would change an API contract.
   */
  it("answers the same way on both Postgres codes for a blocked delete", async () => {
    const statuses = await Promise.all(
      ["23001", "23503"].map(async code => {
        try {
          await withHttpErrors(
            "delete",
            throwing(driverError(code, "still referenced")),
            { contentTypeId: CONTENT_TYPE_ID },
          );
        } catch (error) {
          return (error as HTTPException).status;
        }

        return 0;
      }),
    );

    expect(statuses).toEqual([409, 409]);
  });

  it("rethrows an unrecognised failure for the global handler", async () => {
    // A 500 with nothing in it beats a guessed status: `app.onError` logs the
    // detail and answers "Internal Server Error" in production.
    const unknown = Object.assign(new Error("connection terminated"), {
      code: "57P01",
    });

    await expect(
      withHttpErrors("update", throwing(unknown), {
        contentTypeId: CONTENT_TYPE_ID,
      }),
    ).rejects.toBe(unknown);
  });
});

describe("domain failures map onto their documented codes", () => {
  it("answers a stale write with a structured version conflict", async () => {
    const result = await responseOf(
      throwing(
        new ContentVersionConflict({
          contentTypeId: CONTENT_TYPE_ID,
          currentVersion: 6,
          expectedVersion: 4,
          itemId: 7,
        }),
      ),
      { structured: true },
    );

    expect(result.status).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      code: "CONTENT_VERSION_CONFLICT",
      contentTypeId: CONTENT_TYPE_ID,
      currentVersion: 6,
      expectedVersion: 4,
      itemId: 7,
    });
  });

  it("answers a unique clash with a structured conflict on an editorial route", async () => {
    const result = await responseOf(
      throwing(driverError("23505", "Key (code)=(guide-001) already exists.")),
      { itemId: 7, structured: true },
    );

    expect(JSON.parse(result.body)).toEqual({
      code: "CONTENT_UNIQUE_CONFLICT",
      contentTypeId: CONTENT_TYPE_ID,
      itemId: 7,
    });
  });

  it("answers an unrestorable revision with 422 and the field names", async () => {
    const result = await responseOf(
      throwing(
        new ContentRevisionNotRestorable({
          contentTypeId: CONTENT_TYPE_ID,
          fields: ["category"],
          revisionId: 12,
        }),
      ),
      { structured: true },
    );

    expect(result.status).toBe(422);
    expect(JSON.parse(result.body)).toEqual({
      code: "CONTENT_REVISION_NOT_RESTORABLE",
      contentTypeId: CONTENT_TYPE_ID,
      fields: ["category"],
      revisionId: 12,
    });
  });

  it("answers a refused schedule with 400 and a code", async () => {
    const result = await responseOf(
      throwing(
        new ContentScheduleError("That time has already passed.", {
          code: "CONTENT_SCHEDULE_IN_PAST",
          contentTypeId: CONTENT_TYPE_ID,
        }),
      ),
    );

    expect(result.status).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      code: "CONTENT_SCHEDULE_IN_PAST",
      contentTypeId: CONTENT_TYPE_ID,
    });
  });

  it("answers a missing relation target with 400 and the ids the caller sent", async () => {
    const result = await responseOf(
      throwing(
        new ContentAdvancedInputError({
          code: "CONTENT_RELATION_MISSING_TARGET",
          contentTypeId: CONTENT_TYPE_ID,
          field: "categories",
          ids: [99],
          message:
            'Relation "categories" references a record that no longer exists: 99.',
        }),
      ),
    );

    expect(result.status).toBe(400);
    // The caller's own input echoed back - nothing internal in it.
    expect(result.body).toContain("categories");
    expect(result.body).toContain("99");
  });

  it("answers a repeatable child that belongs elsewhere with 400", async () => {
    const result = await responseOf(
      throwing(
        new ContentAdvancedInputError({
          code: "CONTENT_REPEATABLE_UNKNOWN_CHILD",
          contentTypeId: CONTENT_TYPE_ID,
          field: "faq",
          ids: [5],
          message:
            'Repeatable "faq" was sent an entry that does not belong to this record: 5.',
        }),
      ),
    );

    expect(result.status).toBe(400);
  });

  it("answers invalid input with 400 and no issue tree", async () => {
    const result = await responseOf(
      throwing(
        new ZodError([
          {
            code: "too_small",
            minimum: 3,
            origin: "string",
            path: ["title"],
            message: "Too small",
          },
        ]),
      ),
    );

    expect(result.status).toBe(400);
    expect(result.body).toBe("Invalid input data.");
    expect(result.body).not.toContain("title");
  });

  it("keeps a written-for-the-client input error readable", async () => {
    const result = await responseOf(
      throwing(
        new ContentInputError('The slug for "title" normalises to nothing.', {
          contentTypeId: CONTENT_TYPE_ID,
        }),
      ),
    );

    expect(result.status).toBe(400);
    expect(result.body).toContain("normalises to nothing");
  });
});

describe("translation failures keep their own union", () => {
  it.each([
    [
      "a stale locale write",
      new ContentTranslationVersionConflict({
        contentTypeId: CONTENT_TYPE_ID,
        currentVersion: 5,
        expectedVersion: 2,
        itemId: 7,
        locale: "pl",
      }),
      409,
      "CONTENT_TRANSLATION_VERSION_CONFLICT",
    ],
    [
      "deleting the default translation",
      new ContentDefaultTranslationRequired({
        contentTypeId: CONTENT_TYPE_ID,
        itemId: 7,
        locale: "en",
      }),
      409,
      "CONTENT_DEFAULT_TRANSLATION_REQUIRED",
    ],
    [
      "a second translation in one locale",
      new ContentTranslationExists({
        contentTypeId: CONTENT_TYPE_ID,
        itemId: 7,
        locale: "pl",
      }),
      409,
      "CONTENT_TRANSLATION_EXISTS",
    ],
    [
      "a locale this install switched off",
      new ContentLanguageError({
        contentTypeId: CONTENT_TYPE_ID,
        locale: "de",
        reason: "disabled",
      }),
      409,
      "CONTENT_LANGUAGE_DISABLED",
    ],
  ])("answers %s with %i and a code", async (_why, error, status, code) => {
    const result = await translationResponseOf(throwing(error));

    expect(result.status).toBe(status);
    expect(JSON.parse(result.body)).toMatchObject({ code });
  });

  it("answers an unknown locale with 404 rather than a conflict", async () => {
    // "There is no such language" and "this install switched it off" want
    // different answers: only the second is something an admin can undo.
    const result = await translationResponseOf(
      throwing(
        new ContentLanguageError({
          contentTypeId: CONTENT_TYPE_ID,
          locale: "zz",
          reason: "missing",
        }),
      ),
    );

    expect(result.status).toBe(404);
  });

  it("answers a translation of a record that is gone with 404", async () => {
    const result = await translationResponseOf(
      throwing(
        new ContentTranslationItemMissing({
          contentTypeId: CONTENT_TYPE_ID,
          itemId: 7,
        }),
      ),
    );

    expect(result.status).toBe(404);
  });

  it("turns a localized unique clash into the translation union, with the locale", async () => {
    const result = await translationResponseOf(
      throwing(
        driverError("23505", "Key (languageId, slug)=(2, hello) exists"),
      ),
    );

    expect(result.status).toBe(409);
    expect(JSON.parse(result.body)).toEqual({
      code: "CONTENT_TRANSLATION_UNIQUE_CONFLICT",
      contentTypeId: CONTENT_TYPE_ID,
      itemId: 7,
      locale: "pl",
    });
  });
});

/**
 * The regression that matters most, because its symptom is invisible: a response
 * body that happens to contain the constraint name reads fine to a human and
 * hands an attacker the schema.
 */
describe("no internal detail crosses the boundary", () => {
  const LEAKS = [
    "example_articles_code_key",
    "example_articles",
    "public",
    "23505",
    "23503",
    "insert into",
    "Key (code)=(guide-001)",
  ];

  it.each(["23505", "23503", "23502", "23001"])(
    "keeps the driver's detail out of the %s response",
    async code => {
      const result = await responseOf(
        throwing(driverError(code, "Key (code)=(guide-001) already exists.")),
      );

      for (const leak of LEAKS) {
        expect(result.body.toLowerCase()).not.toContain(leak.toLowerCase());
      }
    },
  );

  it("keeps it out of the structured editorial body too", async () => {
    const result = await responseOf(
      throwing(driverError("23505", "Key (code)=(guide-001) already exists.")),
      { itemId: 7, structured: true },
    );

    for (const leak of LEAKS) {
      expect(result.body.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it("keeps it out of the translation body", async () => {
    const result = await translationResponseOf(
      throwing(driverError("23505", "Key (slug)=(hello) already exists.")),
    );

    for (const leak of LEAKS) {
      expect(result.body.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it("never serialises an Error object into a body", async () => {
    // A body of `{}` is what `JSON.stringify(new Error(...))` produces, and a
    // body of `{"message":...,"stack":...}` is what a helpful serializer
    // produces. Neither is a contract.
    const result = await responseOf(throwing(driverError("23505", "boom")), {
      itemId: 7,
      structured: true,
    });

    expect(result.body).not.toContain("stack");
    expect(JSON.parse(result.body)).not.toHaveProperty("message");
  });
});
