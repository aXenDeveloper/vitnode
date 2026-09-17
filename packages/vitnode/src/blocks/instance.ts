import type { AnyBlockInstance, BlockInstance } from "./types";

import {
  BLOCK_INSTANCE_ID_LENGTH,
  BLOCK_INSTANCE_ID_PATTERN,
  CONTENT_AREA_KIND,
} from "./const";
import { BlockError } from "./errors";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const TIME_LENGTH = 10;

const RANDOM_LENGTH = BLOCK_INSTANCE_ID_LENGTH - TIME_LENGTH;

const randomBytes = (length: number): Uint8Array => {
  const source: Crypto | undefined = globalThis.crypto;

  if (!source?.getRandomValues) {
    throw new BlockError(
      "This runtime has no `crypto.getRandomValues`, so a block instance id cannot be generated. A block id is a durable identity that revisions, reordering and merges are keyed by, and `Math.random()` is not strong enough to be one. VitNode requires Node 22 or later; in a browser `crypto.getRandomValues` is available in every context, secure or not.",
    );
  }

  return source.getRandomValues(new Uint8Array(length));
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
  variant?: string,
): BlockInstance<TType, TData> => ({
  data,
  id: createBlockInstanceId(),
  type,
  ...(variant === undefined ? {} : { variant }),
});

export const isBlockInstance = (value: unknown): value is AnyBlockInstance => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const instance = value as Record<string, unknown>;

  if (instance.kind === CONTENT_AREA_KIND) return false;

  return (
    isBlockInstanceId(instance.id) &&
    typeof instance.type === "string" &&
    (instance.variant === undefined || typeof instance.variant === "string") &&
    typeof instance.data === "object" &&
    instance.data !== null &&
    !Array.isArray(instance.data)
  );
};
