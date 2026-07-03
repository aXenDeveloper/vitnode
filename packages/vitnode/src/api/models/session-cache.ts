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
): string => `session:admin:${deviceId}:${hashedToken}`;

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
