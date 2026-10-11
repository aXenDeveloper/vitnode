import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashSessionToken } from "./session-token";

/** What the sessions table actually holds, computed independently. */
const reference = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

describe("hashSessionToken", () => {
  it("is SHA-256 over the token's UTF-8 bytes", async () => {
    await expect(hashSessionToken("a-session-token")).resolves.toBe(
      reference("a-session-token"),
    );
  });

  it("pads a byte below 0x10 rather than dropping its zero", async () => {
    const hashed = await hashSessionToken("1");

    // Without the padding the string would be short of 64 characters and no
    // row would ever be found again.
    expect(hashed).toBe(reference("1"));
    expect(hashed).toHaveLength(64);
  });

  it("encodes as UTF-8, not as UTF-16 code units", async () => {
    // A multi-byte character is where the two encodings part ways, and every
    // stored token would stop matching if this changed.
    const key = String.fromCodePoint(0x1f511);

    await expect(hashSessionToken(key)).resolves.toBe(
      createHash("sha256").update(Buffer.from(key, "utf8")).digest("hex"),
    );
  });
});
