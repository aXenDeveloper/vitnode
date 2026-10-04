import { createHmac, timingSafeEqual } from "node:crypto";

import { CONFIG, INSECURE_CRON_SECRETS } from "@/lib/config";

export const FORWARDED_SIGNATURE_HEADER = "x-vitnode-forwarded-signature";

export const FORWARDED_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

const SIGNING_KEY_CONTEXT = "vitnode:forwarded-ip";

export const resolveForwardedIpSecret = (): string | undefined => {
  const secret = CONFIG.cronJobSecret;

  return INSECURE_CRON_SECRETS.includes(secret) ? undefined : secret;
};

const signingKey = (secret: string): Buffer =>
  createHmac("sha256", secret).update(SIGNING_KEY_CONTEXT).digest();

const digest = ({
  forwardedFor,
  secret,
  timestamp,
}: {
  forwardedFor: string;
  secret: string;
  timestamp: number;
}): Buffer =>
  createHmac("sha256", signingKey(secret))
    .update(`${timestamp}.${forwardedFor}`)
    .digest();

export const signForwardedFor = ({
  forwardedFor,
  now = Date.now(),
  secret,
}: {
  forwardedFor: string;
  now?: number;
  secret: string;
}): string =>
  `${now}.${digest({ forwardedFor, secret, timestamp: now }).toString("hex")}`;

export const verifyForwardedFor = ({
  forwardedFor,
  now = Date.now(),
  secret,
  signature,
}: {
  forwardedFor: string;
  now?: number;
  secret: string;
  signature: string;
}): boolean => {
  const [rawTimestamp, rawDigest, ...rest] = signature.split(".");
  if (!rawTimestamp || !rawDigest || rest.length > 0) return false;

  const timestamp = Number(rawTimestamp);
  if (!Number.isSafeInteger(timestamp)) return false;
  if (Math.abs(now - timestamp) > FORWARDED_SIGNATURE_MAX_AGE_MS) return false;

  const expected = digest({ forwardedFor, secret, timestamp });
  const received = Buffer.from(rawDigest, "hex");

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
};
