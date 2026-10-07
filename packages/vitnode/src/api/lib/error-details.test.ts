// @vitest-environment node
import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { describeError } from "./error-details";

const drizzleQueryError = (
  sql: string,
  cause: unknown,
  params: unknown[] = [26],
) => new DrizzleQueryError(sql, params, cause as Error);

const postgresError = (message: string, fields: Record<string, unknown>) =>
  Object.assign(new Error(message), fields);

describe("describeError", () => {
  it("keeps the driver complaint hidden in `cause`", () => {
    const error = drizzleQueryError(
      'select "example_articles"."animation" from "example_articles"',
      postgresError('column "animation" does not exist', {
        code: "42703",
        position: 8,
      }),
    );

    expect(describeError(error)).toBe(
      'Failed query: select "example_articles"."animation" from "example_articles"\nparams: [redacted]\n' +
        'Caused by: column "animation" does not exist (code: 42703, position: 8)',
    );
  });

  it("walks a whole chain of causes", () => {
    const error = new Error("outer", {
      cause: new Error("middle", { cause: new Error("inner") }),
    });

    expect(describeError(error)).toBe(
      "outer\nCaused by: middle\nCaused by: inner",
    );
  });

  it("stops on a cause cycle", () => {
    const inner = new Error("inner");
    const outer = new Error("outer", { cause: inner });
    inner.cause = outer;

    expect(describeError(outer)).toBe("outer\nCaused by: inner");
  });

  it("describes a non-Error cause", () => {
    expect(describeError(new Error("outer", { cause: "boom" }))).toBe(
      "outer\nCaused by: boom",
    );
  });

  it("omits driver fields that are absent or empty", () => {
    expect(
      describeError(
        postgresError("connection terminated", { code: "", detail: undefined }),
      ),
    ).toBe("connection terminated");
  });

  it("falls back to the name of a message-less error", () => {
    const error = new Error("");
    error.name = "ConnectionError";

    expect(describeError(error)).toBe("ConnectionError");
  });

  it("never returns an empty message", () => {
    expect(describeError(undefined)).toBe("Unknown error");
    expect(describeError(null)).toBe("Unknown error");
  });

  it("redacts bound query parameters and keeps the SQL and the cause", () => {
    const error = drizzleQueryError(
      'insert into "core_users" ("email", "password") values ($1, $2)',
      postgresError(
        'duplicate key value violates unique constraint "core_users_email_unique"',
        {
          code: "23505",
          detail: "Key (email)=(bob@example.com) already exists.",
        },
      ),
      ["bob@example.com", "$argon2id$v=19$m=65536$hash"],
    );

    const message = describeError(error);

    expect(message).toBe(
      'Failed query: insert into "core_users" ("email", "password") values ($1, $2)\nparams: [redacted]\n' +
        'Caused by: duplicate key value violates unique constraint "core_users_email_unique" (code: 23505, detail: Key (email)=([redacted]) already exists.)',
    );
    expect(message).not.toContain("bob@example.com");
    expect(message).not.toContain("argon2id");
  });

  it("redacts a generated secret bound to an insert", () => {
    const secret = "f3c1d2e4b5a6978812345678abcdef00";
    const error = drizzleQueryError(
      'insert into "core_secrets" ("name", "value") values ($1, $2)',
      new Error("connection terminated unexpectedly"),
      ["cron", secret],
    );

    expect(describeError(error)).not.toContain(secret);
  });

  it("redacts the row Postgres echoes on a not-null violation", () => {
    const error = postgresError(
      'null value in column "name" violates not-null constraint',
      {
        code: "23502",
        detail: "Failing row contains (1, null, bob@example.com, $argon2id$x).",
      },
    );

    expect(describeError(error)).toBe(
      'null value in column "name" violates not-null constraint (code: 23502, detail: Failing row contains ([redacted]).)',
    );
  });

  it("redacts a query error that only survives as text", () => {
    expect(
      describeError("Failed query: select 1 where a = $1\nparams: hunter2"),
    ).toBe("Failed query: select 1 where a = $1\nparams: [redacted]");
  });

  it("redacts addresses and credentials in any message", () => {
    expect(
      describeError(
        new Error("rejected bob@example.com token=abc123 Bearer abc.def"),
      ),
    ).toBe("rejected [email] token=[redacted] Bearer [redacted]");
  });
});
