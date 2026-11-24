import type {
  ChatCipher,
  ChatPlainPayload,
  ChatWrappedKey,
  ChatWrappedPrivateKey,
} from "@vitnode/api/lib/chat/e2e";

import { CHAT_E2E } from "@vitnode/api/lib/chat/e2e";

/**
 * End-to-end encryption for chat, with WebCrypto only. Nothing here talks to
 * the API: callers send the wrapped keys and ciphertexts it returns.
 * Browser-only (works in any runtime with `crypto.subtle`).
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

type Bytes = Uint8Array<ArrayBuffer>;

const randomBytes = (length: number): Bytes =>
  globalThis.crypto.getRandomValues(new Uint8Array(length));

export const toBase64 = (bytes: ArrayBuffer | Bytes): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);

  return btoa(binary);
};

export const fromBase64 = (value: string): Bytes => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

const aesEncrypt = async (key: CryptoKey, data: Bytes) => {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({ iv, name: "AES-GCM" }, key, data);

  return { ct: toBase64(ct), iv: toBase64(iv) };
};

const aesDecrypt = async (
  key: CryptoKey,
  { ct, iv }: { ct: string; iv: string },
): Promise<Bytes> =>
  new Uint8Array(
    await subtle().decrypt(
      { iv: fromBase64(iv), name: "AES-GCM" },
      key,
      fromBase64(ct),
    ),
  );

/** A key from a passcode: PBKDF2-SHA-256 with the given salt and iterations. */
const passcodeKey = async (
  passcode: string,
  salt: Bytes,
  iterations: number,
): Promise<CryptoKey> => {
  const base = await subtle().importKey(
    "raw",
    encoder.encode(passcode.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return await subtle().deriveKey(
    { hash: "SHA-256", iterations, name: "PBKDF2", salt },
    base,
    { length: 256, name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
};

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A new recovery key: 30 random symbols in groups of 5 (~150 bits). */
export const generateRecoveryKey = (): string => {
  const bytes = randomBytes(30);
  const symbols = [...bytes].map(
    byte => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length],
  );

  return Array.from({ length: 6 }, (_, group) =>
    symbols.slice(group * 5, group * 5 + 5).join(""),
  ).join("-");
};

/** Ignores spaces, dashes and case, so a hand-typed key still works. */
export const normalizeRecoveryKey = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/gu, "");

/** A key from a high-entropy recovery key: HKDF-SHA-256 is enough. */
const recoveryWrapKey = async (
  recoveryKey: string,
  salt: Bytes,
): Promise<CryptoKey> => {
  const base = await subtle().importKey(
    "raw",
    encoder.encode(normalizeRecoveryKey(recoveryKey)),
    "HKDF",
    false,
    ["deriveKey"],
  );

  return await subtle().deriveKey(
    {
      hash: "SHA-256",
      info: encoder.encode("vitnode-chat-recovery"),
      name: "HKDF",
      salt,
    },
    base,
    { length: 256, name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
};

/** Wraps the private key (PKCS#8 bytes) under a passcode or a recovery key. */
export const wrapPrivateKey = async (
  pkcs8: Bytes,
  secret: { passcode: string } | { recoveryKey: string },
): Promise<ChatWrappedPrivateKey> => {
  const salt = randomBytes(16);
  const isPasscode = "passcode" in secret;
  const key = isPasscode
    ? await passcodeKey(secret.passcode, salt, CHAT_E2E.passcodeIterations)
    : await recoveryWrapKey(secret.recoveryKey, salt);

  return {
    ...(await aesEncrypt(key, pkcs8)),
    iterations: isPasscode ? CHAT_E2E.passcodeIterations : null,
    salt: toBase64(salt),
    v: CHAT_E2E.version,
  };
};

/**
 * Unwraps the private key's PKCS#8 bytes. Throws when the passcode or
 * recovery key is wrong (AES-GCM authentication fails).
 */
export const unwrapPrivateKeyBytes = async (
  wrapped: ChatWrappedPrivateKey,
  secret: { passcode: string } | { recoveryKey: string },
): Promise<Bytes> => {
  const salt = fromBase64(wrapped.salt);
  const key =
    "passcode" in secret
      ? await passcodeKey(
          secret.passcode,
          salt,
          wrapped.iterations ?? CHAT_E2E.passcodeIterations,
        )
      : await recoveryWrapKey(secret.recoveryKey, salt);

  return await aesDecrypt(key, wrapped);
};

/** Imports PKCS#8 bytes as a private key that can't be read back out. */
export const importPrivateKey = async (pkcs8: Bytes): Promise<CryptoKey> =>
  await subtle().importKey("pkcs8", pkcs8, ECDH, false, ["deriveBits"]);

/** A new key pair: the public key (raw, base64) and the private key bytes. */
export const generateIdentity = async (): Promise<{
  pkcs8: Bytes;
  publicKey: string;
}> => {
  const pair = await subtle().generateKey(ECDH, true, ["deriveBits"]);
  const [raw, pkcs8] = await Promise.all([
    subtle().exportKey("raw", pair.publicKey),
    subtle().exportKey("pkcs8", pair.privateKey),
  ]);

  return { pkcs8: new Uint8Array(pkcs8), publicKey: toBase64(raw) };
};

/** ECDH secret -> HKDF -> AES-GCM key, for wrapping one chat key. */
const sharedWrapKey = async (
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> => {
  const bits = await subtle().deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  );
  const base = await subtle().importKey("raw", bits, "HKDF", false, [
    "deriveKey",
  ]);

  return await subtle().deriveKey(
    {
      hash: "SHA-256",
      info: encoder.encode("vitnode-chat-key"),
      name: "HKDF",
      salt: new Uint8Array(32),
    },
    base,
    { length: 256, name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
};

/** A new random chat key. */
export const generateChatKey = async (): Promise<CryptoKey> =>
  await subtle().generateKey({ length: 256, name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);

/** Wraps a chat key for one member's public key (ECIES with an ephemeral key). */
export const wrapChatKey = async (
  chatKey: CryptoKey,
  recipientPublicKey: string,
): Promise<ChatWrappedKey> => {
  const recipient = await subtle().importKey(
    "raw",
    fromBase64(recipientPublicKey),
    ECDH,
    false,
    [],
  );
  const ephemeral = await subtle().generateKey(ECDH, true, ["deriveBits"]);
  const wrapKey = await sharedWrapKey(ephemeral.privateKey, recipient);
  const raw = new Uint8Array(await subtle().exportKey("raw", chatKey));
  const epk = await subtle().exportKey("raw", ephemeral.publicKey);

  return {
    ...(await aesEncrypt(wrapKey, raw)),
    epk: toBase64(epk),
    v: CHAT_E2E.version,
  };
};

/** Unwraps a chat key with the member's private key. */
export const unwrapChatKey = async (
  wrapped: ChatWrappedKey,
  privateKey: CryptoKey,
): Promise<CryptoKey> => {
  const ephemeral = await subtle().importKey(
    "raw",
    fromBase64(wrapped.epk),
    ECDH,
    false,
    [],
  );
  const wrapKey = await sharedWrapKey(privateKey, ephemeral);
  const raw = await aesDecrypt(wrapKey, wrapped);

  // Extractable, so a member can share it again with someone who lost theirs.
  return await subtle().importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
};

const commitmentOf = async (frankingKey: Bytes, text: string) => {
  const key = await subtle().importKey(
    "raw",
    frankingKey,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await subtle().sign("HMAC", key, encoder.encode(text));

  return [...new Uint8Array(signature)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Encrypts a message. Returns the body to send, the commitment the server
 * stores in clear, and nothing else: the franking key travels inside the
 * ciphertext.
 */
export const encryptChatMessage = async (
  chatKey: CryptoKey,
  text: string,
): Promise<{ body: string; commitment: string }> => {
  const frankingKey = randomBytes(32);
  const payload: ChatPlainPayload = { fk: toBase64(frankingKey), t: text };
  const cipher: ChatCipher = {
    ...(await aesEncrypt(chatKey, encoder.encode(JSON.stringify(payload)))),
    v: CHAT_E2E.version,
  };

  return {
    body: JSON.stringify(cipher),
    commitment: await commitmentOf(frankingKey, text),
  };
};

/** Decrypts a message body; throws when the key is wrong or it was tampered with. */
export const decryptChatMessage = async (
  chatKey: CryptoKey,
  body: string,
): Promise<ChatPlainPayload> => {
  const cipher = JSON.parse(body) as ChatCipher;
  const plain = await aesDecrypt(chatKey, cipher);
  const payload = JSON.parse(
    decoder.decode(plain),
  ) as Partial<ChatPlainPayload>;
  if (typeof payload.t !== "string" || typeof payload.fk !== "string") {
    throw new Error("Malformed message.");
  }

  return { fk: payload.fk, t: payload.t };
};
