import { z } from "zod";

/**
 * Formats of end-to-end encrypted chat. The browser does all the crypto with
 * WebCrypto; the server only stores and checks the shape of what it gets.
 * Browser-safe.
 *
 * - Each member has an ECDH P-256 key pair. The private key never leaves the
 *   browser unencrypted: it is stored wrapped with AES-GCM under a key
 *   derived from the member's passcode (PBKDF2-SHA-256), and once more under
 *   a key derived from their recovery key.
 * - Each encrypted chat has one random AES-GCM-256 key, wrapped for every
 *   member with ECIES (an ephemeral P-256 key, ECDH, HKDF-SHA-256, AES-GCM).
 * - A message is AES-GCM ciphertext of `{ t: text, fk: frankingKey }`. Its
 *   `commitment` is HMAC-SHA-256(fk, text), stored in clear, so a reporter can
 *   later reveal the text and `fk` and the server can prove the text is what
 *   was sent (message franking).
 */
export const CHAT_E2E = {
  /** Bumped when a format changes; stored in every envelope. */
  version: 1,
  /** PBKDF2 iterations for the passcode (OWASP 2023 for SHA-256). */
  passcodeIterations: 600_000,
  passcodeMinLength: 8,
  passcodeMaxLength: 128,
  /** Characters of base64 ciphertext one message may take. */
  messageMaxChars: 24_000,
  /** Hex characters of an HMAC-SHA-256 commitment. */
  commitmentLength: 64,
  /** How long a reporter's disclosure waits for its report. */
  disclosureTtlMinutes: 60,
} as const;

const base64 = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/u);

/** AES-GCM output: a 12-byte IV and the ciphertext with its tag. */
export const zodChatCipher = z.strictObject({
  ct: base64(CHAT_E2E.messageMaxChars),
  iv: base64(24),
  v: z.literal(CHAT_E2E.version),
});
export type ChatCipher = z.infer<typeof zodChatCipher>;

/** The private key wrapped under a passcode- or recovery-derived key. */
export const zodWrappedPrivateKey = z.strictObject({
  ct: base64(1024),
  /** PBKDF2 iterations; `null` for the recovery wrap, which uses HKDF. */
  iterations: z.number().int().min(100_000).max(10_000_000).nullable(),
  iv: base64(24),
  salt: base64(64),
  v: z.literal(CHAT_E2E.version),
});
export type ChatWrappedPrivateKey = z.infer<typeof zodWrappedPrivateKey>;

/** A chat key wrapped for one member (ECIES). */
export const zodWrappedChatKey = z.strictObject({
  ct: base64(256),
  /** The ephemeral public key, raw uncompressed P-256 point. */
  epk: base64(128),
  iv: base64(24),
  v: z.literal(CHAT_E2E.version),
});
export type ChatWrappedKey = z.infer<typeof zodWrappedChatKey>;

/** A member's public key, raw uncompressed P-256 point. */
export const zodChatPublicKey = base64(128);

export const zodCommitment = z
  .string()
  .length(CHAT_E2E.commitmentLength)
  .regex(/^[0-9a-f]+$/u);

/** One chat key for one member, as start, add and rewrap requests send it. */
export const zodChatKeyGrant = z.object({
  keyVersion: z.number().int().positive(),
  userId: z.number().int().positive(),
  wrappedKey: zodWrappedChatKey,
});
export type ChatKeyGrant = z.infer<typeof zodChatKeyGrant>;

/** What the encrypted payload of a message holds once decrypted. */
export interface ChatPlainPayload {
  /** The franking key, base64, 32 random bytes. */
  fk: string;
  t: string;
}

/** Reads a stored message body as a cipher, or `null` when it isn't one. */
export const parseChatCipher = (body: null | string): ChatCipher | null => {
  if (!body) return null;
  try {
    const parsed = zodChatCipher.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
