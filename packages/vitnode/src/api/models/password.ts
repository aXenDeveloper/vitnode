import crypto from "node:crypto";

/** Bytes of salt per password. Stored hex-encoded, so 32 characters. */
const SALT_BYTES = 16;

/** Length of the derived key, in bytes. */
const KEY_BYTES = 64;

/**
 * A syntactically valid hash that matches nothing.
 *
 * {@link PasswordModel.verifyDummyPassword} derives against it so that "no such
 * account" costs the same as "wrong password" - see that method.
 */
const DUMMY_HASH = `${"0".repeat(SALT_BYTES * 2)}:${"0".repeat(KEY_BYTES * 2)}`;

const scrypt = async (password: string, salt: string): Promise<Buffer> =>
  await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_BYTES, (err, derivedKey) => {
      if (err) {
        reject(err);

        return;
      }

      resolve(derivedKey);
    });
  });

export class PasswordModel {
  async encryptPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
    const derivedKey = await scrypt(password, salt);

    return `${salt}:${derivedKey.toString("hex")}`;
  }

  /**
   * Burns one password derivation and returns `false`.
   *
   * Sign-in used to answer "no such email" without hashing anything, so an
   * unknown address came back in about a millisecond and a known one took as
   * long as scrypt does. That difference is measurable over the network, which
   * turns the sign-in endpoint into an oracle for *which addresses hold
   * accounts* - the list every credential-stuffing run wants first.
   *
   * Calling this on the not-found path spends the same work, so both answers
   * take the same time and say the same thing.
   */
  async verifyDummyPassword(password: string): Promise<boolean> {
    return await this.verifyPassword(password, DUMMY_HASH);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [salt, key] = hash.split(":");

    // A row whose hash is not `salt:key` cannot match anything, and saying so is
    // the whole answer. Reading `key` as hex regardless used to throw out of the
    // promise executor, which reached the client as a 500 rather than as a
    // refused sign-in.
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = await scrypt(password, salt);

    if (keyBuffer.length !== derivedKey.length) {
      // Still compare, so a truncated stored hash is not distinguishable by how
      // quickly it is rejected.
      crypto.timingSafeEqual(derivedKey, derivedKey);

      return false;
    }

    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }
}

export class ForgotPasswordTokenModel {
  generateResetToken() {
    return crypto.randomBytes(32).toString("base64url");
  }

  hashResetToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
