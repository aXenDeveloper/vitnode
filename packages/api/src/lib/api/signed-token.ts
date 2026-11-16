import type { z } from "zod";

import crypto from "node:crypto";

const encodePayload = (payload: unknown): string =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const sign = (secret: string, body: string): string =>
  crypto.createHmac("sha256", secret).update(body).digest("base64url");

export const signPayload = (secret: string, payload: unknown): string => {
  const body = encodePayload(payload);

  return `${body}.${sign(secret, body)}`;
};

/**
 * Reads a payload back, or returns `null`.
 *
 * Never throws, whatever arrives. A token comes out of a URL, so "not
 * base64url", "not JSON", "no dot", "three dots" and "an object of the wrong
 * shape" are all ordinary inputs rather than exceptional ones - and a caller
 * that has to wrap every verification in `try` eventually forgets to.
 *
 * The signature is compared with `timingSafeEqual`, which needs both buffers to
 * be the same length, so the length check comes first. That check leaks only
 * the length of a hex-ish string that is always 43 characters for a valid
 * token, which is to say nothing.
 */
export const verifySignedPayload = <TValue>(
  secret: string,
  token: string,
  schema: z.ZodType<TValue>,
): null | TValue => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(secret, body), "utf8");
  const provided = Buffer.from(signature, "utf8");

  if (expected.length !== provided.length) return null;
  if (!crypto.timingSafeEqual(expected, provided)) return null;

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    const parsed = schema.safeParse(decoded);

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
