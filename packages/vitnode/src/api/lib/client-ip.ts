import type { Context } from "hono";

import { isIP } from "node:net";

import {
  FORWARDED_SIGNATURE_HEADER,
  resolveForwardedIpSecret,
  verifyForwardedFor,
} from "@/lib/fetcher/forwarded-signature.server";
import { CONFIG } from "@/lib/config";
import {
  FORWARDED_IP_FALLBACK,
  resolveVisitorIp,
} from "@/lib/fetcher/request-context";

const UNKNOWN_CLIENT_IP = "127.0.0.1";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const nodeSocketAddress = (
  env: Record<string, unknown>,
): string | undefined => {
  const incoming = env.incoming;
  if (!isRecord(incoming)) return undefined;

  const socket = incoming.socket;
  if (!isRecord(socket)) return undefined;

  return nonEmptyString(socket.remoteAddress);
};

const bunSocketAddress = (
  env: Record<string, unknown>,
  request: Request,
): string | undefined => {
  const server = env.server;
  if (!isRecord(server)) return undefined;

  const requestIP = server.requestIP;
  if (typeof requestIP !== "function") return undefined;

  const info: unknown = (requestIP as (request: Request) => unknown)(request);

  return isRecord(info) ? nonEmptyString(info.address) : undefined;
};

const denoSocketAddress = (
  env: Record<string, unknown>,
): string | undefined => {
  const remoteAddr = env.remoteAddr;

  return isRecord(remoteAddr) ? nonEmptyString(remoteAddr.hostname) : undefined;
};

/**
 * The API mounted in-process by a host app (the Single App's `/api/*` route)
 * has no socket of its own; the host hands over the one it accepted.
 */
const hostSocketAddress = (env: Record<string, unknown>): string | undefined =>
  nonEmptyString(env.clientAddress);

const socketAddress = (c: Context): string | undefined => {
  const env: unknown = c.env;
  if (!isRecord(env)) return undefined;

  return (
    nodeSocketAddress(env) ??
    bunSocketAddress(env, c.req.raw) ??
    denoSocketAddress(env) ??
    hostSocketAddress(env)
  );
};

// Behind `VITNODE_TRUSTED_PROXY_HOPS` proxies the socket is the closest proxy,
// so the visitor is that many hops from the right of `X-Forwarded-For`.
// Anything further left is client-written and never read.
const proxiedAddress = (c: Context): string | undefined => {
  const address = resolveVisitorIp({
    forwardedFor: c.req.header("x-forwarded-for"),
    socketAddress: socketAddress(c),
    trustedProxyHops: CONFIG.trustedProxyHops,
  });

  return address && isIP(address) ? address : socketAddress(c);
};

const signedForwardedAddress = (c: Context): string | undefined => {
  const secret = resolveForwardedIpSecret();
  const forwardedFor = c.req.header("x-forwarded-for");
  const signature = c.req.header(FORWARDED_SIGNATURE_HEADER);
  if (!secret || !forwardedFor || !signature) return undefined;
  if (!verifyForwardedFor({ forwardedFor, secret, signature }))
    return undefined;

  const closestHop = forwardedFor.split(",").at(-1)?.trim();

  return closestHop && closestHop !== FORWARDED_IP_FALLBACK && isIP(closestHop)
    ? closestHop
    : undefined;
};

export const resolveClientIp = (c: Context): string =>
  signedForwardedAddress(c) ?? proxiedAddress(c) ?? UNKNOWN_CLIENT_IP;

export const clientIpMiddleware = async (
  c: Context,
  next: () => Promise<void>,
) => {
  c.set("ipAddress", resolveClientIp(c));

  await next();
};
