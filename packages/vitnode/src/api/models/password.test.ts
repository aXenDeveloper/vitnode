import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ForgotPasswordTokenModel, PasswordModel } from "./password";

describe("PasswordModel", () => {
  const passwords = new PasswordModel();

  it("verifies a password against its own hash", async () => {
    const hash = await passwords.encryptPassword("Test123!");

    await expect(passwords.verifyPassword("Test123!", hash)).resolves.toBe(
      true,
    );
  });

  it("refuses a different password", async () => {
    const hash = await passwords.encryptPassword("Test123!");

    await expect(passwords.verifyPassword("Test123?", hash)).resolves.toBe(
      false,
    );
  });

  it("salts each hash, so the same password hashes differently", async () => {
    const [a, b] = await Promise.all([
      passwords.encryptPassword("Test123!"),
      passwords.encryptPassword("Test123!"),
    ]);

    expect(a).not.toBe(b);
  });

  it("uses a 16-byte salt", async () => {
    const [salt] = (await passwords.encryptPassword("Test123!")).split(":");

    expect(salt).toHaveLength(32);
  });

  it("still verifies hashes written with the previous 8-byte salt", async () => {
    // The salt is read back out of the stored string, so widening it applies to
    // new hashes only - every existing row has to keep working, or the change
    // locks out every account on the install.
    const salt = "ab".repeat(8);
    const key = scryptSync("Test123!", salt, 64).toString("hex");

    await expect(
      passwords.verifyPassword("Test123!", `${salt}:${key}`),
    ).resolves.toBe(true);
    await expect(
      passwords.verifyPassword("Test123?", `${salt}:${key}`),
    ).resolves.toBe(false);
  });

  describe("a malformed stored hash", () => {
    // These used to throw out of the promise executor and reach the client as a
    // 500 rather than as a refused sign-in.
    it.each([["no-colon"], [""], [":"], ["salt:"], [":key"]])(
      "%s is refused rather than thrown",
      async hash => {
        await expect(passwords.verifyPassword("Test123!", hash)).resolves.toBe(
          false,
        );
      },
    );

    it("is refused when the key is the wrong length", async () => {
      await expect(
        passwords.verifyPassword("Test123!", `${"ab".repeat(16)}:00ff`),
      ).resolves.toBe(false);
    });
  });

  describe("verifyDummyPassword", () => {
    it("always answers false", async () => {
      await expect(passwords.verifyDummyPassword("anything")).resolves.toBe(
        false,
      );
    });

    it("costs about as much as a real verification", async () => {
      // The point of the method: sign-in spends it on the "no such email" path
      // so that path cannot be told from "wrong password" by how long it took.
      const hash = await passwords.encryptPassword("Test123!");

      const timeOf = async (run: () => Promise<unknown>): Promise<number> => {
        const started = performance.now();
        await run();

        return performance.now() - started;
      };

      const real = await timeOf(
        async () => await passwords.verifyPassword("wrong", hash),
      );
      const dummy = await timeOf(
        async () => await passwords.verifyDummyPassword("wrong"),
      );

      // Deliberately loose - this asserts "the same order of magnitude of work",
      // which is what defeats the oracle, not a stopwatch reading.
      expect(dummy).toBeGreaterThan(real / 10);
    });
  });
});

describe("ForgotPasswordTokenModel", () => {
  const tokens = new ForgotPasswordTokenModel();

  it("generates a distinct token each time", () => {
    const generated = new Set(
      Array.from({ length: 50 }, () => tokens.generateResetToken()),
    );

    expect(generated.size).toBe(50);
  });

  it("generates a URL-safe token with 256 bits behind it", () => {
    const token = tokens.generateResetToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("hashes to a stable 64-character digest", () => {
    const digest = tokens.hashResetToken("a-token");

    expect(digest).toHaveLength(64);
    expect(tokens.hashResetToken("a-token")).toBe(digest);
  });

  it("does not hash to the token itself", () => {
    // What the reset row stores has to be useless to whoever reads the table.
    expect(tokens.hashResetToken("a-token")).not.toBe("a-token");
  });

  it("fits the token column, which is varchar(100)", () => {
    expect(
      tokens.hashResetToken(tokens.generateResetToken()).length,
    ).toBeLessThanOrEqual(100);
  });
});
