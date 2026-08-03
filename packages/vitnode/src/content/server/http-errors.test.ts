// @vitest-environment node
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";

import { withHttpErrors } from "./http-errors";

const pgError = (code: string) =>
  Object.assign(new Error("driver said no"), { code });

/** How Drizzle actually surfaces a driver failure. */
const drizzleWrapped = (code: string) =>
  Object.assign(new Error("Failed query"), { cause: pgError(code) });

const reject = async (error: unknown): Promise<never> => {
  await Promise.resolve();
  throw error;
};

const statusOf = async (
  error: unknown,
  action: "create" | "delete" | "update",
) => {
  try {
    await withHttpErrors(action, async () => await reject(error));
  } catch (thrown) {
    if (thrown instanceof HTTPException) return thrown.status;
    throw thrown;
  }

  return 200;
};

describe("withHttpErrors", () => {
  it("passes a successful result through", async () => {
    await expect(
      withHttpErrors("create", async () => await Promise.resolve("ok")),
    ).resolves.toBe("ok");
  });

  it("maps a restricted delete to 409", async () => {
    await expect(statusOf(pgError("23503"), "delete")).resolves.toBe(409);
  });

  it("maps Postgres 18's own RESTRICT code to 409 as well", async () => {
    // Postgres 18 reports a refused `ON DELETE RESTRICT` as `23001`, not
    // `23503`. Reading only the older code turned every blocked delete on a
    // modern server into a 500.
    await expect(statusOf(pgError("23001"), "delete")).resolves.toBe(409);
    // `23001` only ever comes from an update or delete of a referenced row, so
    // it is a conflict whatever the caller was doing - never a 400.
    await expect(statusOf(pgError("23001"), "update")).resolves.toBe(409);
  });

  it("maps a missing relation on write to 400", async () => {
    await expect(statusOf(pgError("23503"), "create")).resolves.toBe(400);
    await expect(statusOf(pgError("23503"), "update")).resolves.toBe(400);
  });

  it("maps a unique violation to 409", async () => {
    await expect(statusOf(pgError("23505"), "create")).resolves.toBe(409);
  });

  it("maps a not-null violation to 400", async () => {
    await expect(statusOf(pgError("23502"), "create")).resolves.toBe(400);
  });

  it("unwraps the code Drizzle hides behind `cause`", async () => {
    // Drizzle throws `DrizzleQueryError`, whose own `code` is undefined - the
    // real Postgres error sits on `cause`.
    await expect(statusOf(drizzleWrapped("23503"), "delete")).resolves.toBe(
      409,
    );
    await expect(statusOf(drizzleWrapped("23505"), "create")).resolves.toBe(
      409,
    );
  });

  it("never leaks the driver message", async () => {
    try {
      await withHttpErrors(
        "delete",
        async () => await reject(drizzleWrapped("23503")),
      );
    } catch (error) {
      expect((error as HTTPException).message).not.toContain("driver said no");
    }
  });

  it("rethrows anything it does not recognise, for the 500 handler", async () => {
    const unknown = new Error("boom");

    await expect(
      withHttpErrors("create", async () => await reject(unknown)),
    ).rejects.toBe(unknown);
  });

  it("passes an HTTPException through untouched", async () => {
    const notFound = new HTTPException(404);

    await expect(
      withHttpErrors("update", async () => await reject(notFound)),
    ).rejects.toBe(notFound);
  });
});
