import type { getUserById } from "./user/get-user-by-id";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUserById>>>;

export const SESSION_CACHE_TTL_SECONDS = 60;

export const sessionCacheKey = (
  hashedToken: string,
  deviceId: number,
): string => `session:user:${deviceId}:${hashedToken}`;

export const adminSessionCacheKey = (
  hashedToken: string,
  deviceId: number,
): string => `session:admin-idle:${deviceId}:${hashedToken}`;

export const sessionCacheTtl = (expiresAt: Date): number =>
  Math.min(
    SESSION_CACHE_TTL_SECONDS,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );

export const reviveSessionUser = (user: SessionUser): SessionUser => ({
  ...user,
  createdAt: new Date(user.createdAt),
  birthday: user.birthday ? new Date(user.birthday) : null,
});

export interface AdminSession {
  expiresAt: Date;
  user: SessionUser;
}

export const reviveAdminSession = (session: AdminSession): AdminSession => ({
  expiresAt: new Date(session.expiresAt),
  user: reviveSessionUser(session.user),
});

export const ADMIN_SESSION_MAX_EXTEND_INTERVAL_MS = 60_000;

export const adminSessionExtendInterval = (idleTimeoutMs: number): number =>
  Math.min(ADMIN_SESSION_MAX_EXTEND_INTERVAL_MS, idleTimeoutMs / 2);

export const isAdminSessionExtensionDue = ({
  expiresAt,
  idleTimeoutMs,
  now = Date.now(),
}: {
  expiresAt: Date;
  idleTimeoutMs: number;
  now?: number;
}): boolean =>
  idleTimeoutMs - (expiresAt.getTime() - now) >
  adminSessionExtendInterval(idleTimeoutMs);
