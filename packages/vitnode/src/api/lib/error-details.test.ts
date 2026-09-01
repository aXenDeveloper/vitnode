// @vitest-environment node
import { describe, expect, it } from "vitest";

import { describeError } from "./error-details";

const drizzleQueryError = (sql: string, cause: unknown) => {
  const error = new Error(`Failed query: ${sql}\nparams: 26`, { cause });
  error.name = "DrizzleQueryError";

  return error;
};

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
      'Failed query: select "example_articles"."animation" from "example_articles"\nparams: 26\n' +
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
});
