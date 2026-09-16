import type { AnyBlockInstance, BlockInstance } from "./types";

import { BLOCK_INSTANCE_ID_LENGTH, BLOCK_INSTANCE_ID_PATTERN } from "./const";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const TIME_LENGTH = 10;

const RANDOM_LENGTH = BLOCK_INSTANCE_ID_LENGTH - TIME_LENGTH;

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  const source: Crypto | undefined = globalThis.crypto;

  if (source?.getRandomValues) {
    source.getRandomValues(bytes);

    return bytes;
  }

  for (let at = 0; at < length; at += 1) {
    bytes[at] = Math.floor(Math.random() * 256);
  }

  return bytes;
};

const encodeTime = (time: number): string => {
  let rest = time;
  let out = "";

  for (let at = 0; at < TIME_LENGTH; at += 1) {
    out = CROCKFORD[rest % 32] + out;
    rest = Math.floor(rest / 32);
  }

  return out;
};

export const createBlockInstanceId = (now = Date.now()): string => {
  const bytes = randomBytes(RANDOM_LENGTH);
  let random = "";

  for (const byte of bytes) random += CROCKFORD[byte % 32];

  return `${encodeTime(now)}${random}`;
};

export const isBlockInstanceId = (value: unknown): value is string =>
  typeof value === "string" && BLOCK_INSTANCE_ID_PATTERN.test(value);

export const createBlockInstance = <TType extends string, TData>(
  type: TType,
  data: TData,
): BlockInstance<TType, TData> => ({
  data,
  id: createBlockInstanceId(),
  type,
});

export const isBlockInstance = (value: unknown): value is AnyBlockInstance => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const instance = value as Record<string, unknown>;

  return (
    isBlockInstanceId(instance.id) &&
    typeof instance.type === "string" &&
    typeof instance.data === "object" &&
    instance.data !== null &&
    !Array.isArray(instance.data)
  );
};
