import type { Context } from "hono";

import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { getCookie } from "hono/cookie";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { checkStaffPermissionOfUser } from "@/api/lib/check-staff-permission";
import { hashSessionToken } from "@/api/lib/session-token";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import {
  type BrowseAnonymouslyPolicy,
  browseAnonymouslyPolicyOf,
  isPresenceHidden,
  PRESENCE_LEASE_TTL_SECONDS,
  PRESENCE_PERSIST_INTERVAL_SECONDS,
  presenceForViewer,
  type UserPresence,
  type UserPresenceSnapshot,
} from "@/lib/user-presence";
import { manifest } from "@/manifest";

/**
 * Who is asking. Public routes pass the user session and moderator
 * permissions; the AdminCP passes its own session and admin permissions, so
 * neither kind of session borrows the other's grants.
 */
export interface PresenceViewer {
  type: PermissionStaffType;
  user: null | { id: number; roleId: number };
}

export const VIEW_HIDDEN_PRESENCE_PERMISSION = {
  module: "users",
  permission: "can_view_hidden_presence",
  plugin: manifest.id,
} as const;

const leaseKey = (userId: number): string => `presence:user:${userId}`;

const persistLockKey = (userId: number): string => `presence:persist:${userId}`;

/**
 * A session's presence identity: one-way from the stored token hash, so a
 * cache key never carries anything a session lookup accepts.
 */
export const presenceSessionId = async (tokenHash: string): Promise<string> =>
  (await hashSessionToken(`presence:${tokenHash}`)).slice(0, 32);

/**
 * Each member's **Browse anonymously** policy from all of their roles, primary
 * and secondary - two queries however many members. Server-only.
 *
 * @example
 * ```ts
 * const policies = await resolveBrowseAnonymouslyPolicies(c, [user]);
 * policies.get(user.id); // "allowed" | "disallowed" | "forced"
 * ```
 */
export const resolveBrowseAnonymouslyPolicies = async (
  c: Context,
  users: readonly { id: number; roleId: number }[],
): Promise<Map<number, BrowseAnonymouslyPolicy>> => {
  if (users.length === 0) return new Map();

  const db = c.get("db");
  const secondary = await db
    .select({
      roleId: core_users_secondary_roles.roleId,
      userId: core_users_secondary_roles.userId,
    })
    .from(core_users_secondary_roles)
    .where(
      inArray(
        core_users_secondary_roles.userId,
        users.map(user => user.id),
      ),
    );

  const roleIdsByUser = new Map(
    users.map(user => [user.id, new Set([user.roleId])]),
  );
  for (const row of secondary) roleIdsByUser.get(row.userId)?.add(row.roleId);

  const roleIds = [
    ...new Set([...roleIdsByUser.values()].flatMap(ids => [...ids])),
  ];
  const roles = await db
    .select({
      allowBrowseAnonymously: core_roles.allowBrowseAnonymously,
      forceBrowseAnonymously: core_roles.forceBrowseAnonymously,
      id: core_roles.id,
    })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));
  const rulesById = new Map(roles.map(role => [role.id, role]));

  return new Map(
    users.map(user => [
      user.id,
      browseAnonymouslyPolicyOf(
        [...(roleIdsByUser.get(user.id) ?? [])].flatMap(
          id => rulesById.get(id) ?? [],
        ),
      ),
    ]),
  );
};

export class UserPresenceModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private async canViewHidden(viewer: PresenceViewer): Promise<boolean> {
    if (!viewer.user) return false;

    return await checkStaffPermissionOfUser(this.c, viewer.user, {
      ...VIEW_HIDDEN_PRESENCE_PERMISSION,
      type: viewer.type,
    });
  }

  private async persistLastSeen(userId: number, now: Date): Promise<void> {
    // The lock is never released: it simply expires, which makes it a
    // cross-instance throttle. Without Redis it always succeeds and the
    // conditional update below is the throttle instead.
    const due = await this.c
      .get("cache")
      .acquireLock(persistLockKey(userId), PRESENCE_PERSIST_INTERVAL_SECONDS);
    if (!due) return;

    // Only ever forward, and only once per interval: an older request racing a
    // newer one finds the newer value already past its threshold and writes
    // nothing.
    const threshold = new Date(
      now.getTime() - PRESENCE_PERSIST_INTERVAL_SECONDS * 1000,
    );

    await this.c
      .get("db")
      .update(core_users)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(core_users.id, userId),
          or(
            isNull(core_users.lastSeenAt),
            lt(core_users.lastSeenAt, threshold),
          ),
        ),
      );
  }

  private async snapshots(
    userIds: number[],
    now: Date,
  ): Promise<Map<number, UserPresenceSnapshot>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.c
      .get("db")
      .select({
        hideOnlineStatus: core_users.hideOnlineStatus,
        id: core_users.id,
        lastSeenAt: core_users.lastSeenAt,
        roleId: core_users.roleId,
      })
      .from(core_users)
      .where(inArray(core_users.id, userIds));
    // Read on every call rather than cached, so a role change applies to the
    // very next presence read.
    const policies = await resolveBrowseAnonymouslyPolicies(this.c, rows);

    const cache = this.c.get("cache");
    const leases = await cache.countLeases(rows.map(row => leaseKey(row.id)));
    // No Redis at all: the persisted activity is the only signal, and it is
    // never older than one persist interval for an active member.
    const fallbackSince = cache.isConfigured()
      ? null
      : now.getTime() - PRESENCE_LEASE_TTL_SECONDS * 1000;

    return new Map(
      rows.map((row, index) => {
        let online = false;
        if (leases) {
          online = (leases[index] ?? 0) > 0;
        } else if (fallbackSince !== null && row.lastSeenAt) {
          online = row.lastSeenAt.getTime() >= fallbackSince;
        }

        return [
          row.id,
          {
            hideOnlineStatus: isPresenceHidden(
              policies.get(row.id) ?? "allowed",
              row.hideOnlineStatus,
            ),
            lastSeenAt: row.lastSeenAt,
            online,
          },
        ];
      }),
    );
  }

  /** The current request's own session identity, or `null` when signed out. */
  async currentSessionId(): Promise<null | string> {
    const token = getCookie(
      this.c,
      this.c.get("core").authorization.cookieName,
    );
    if (!(token && this.c.get("user"))) return null;

    return await presenceSessionId(await hashSessionToken(token));
  }

  /** One member's presence as `viewer` may see it, or `null` if no such member. */
  async get({
    userId,
    viewer = this.viewerOfRequest(),
  }: {
    userId: number;
    viewer?: PresenceViewer;
  }): Promise<null | UserPresence> {
    return (
      (await this.getMany({ userIds: [userId], viewer })).get(userId) ?? null
    );
  }

  /**
   * Many members' presence in three database queries (members, their
   * secondary roles, the roles' Browse anonymously rules) and one cache round
   * trip, however many members. Unknown IDs are left out of the result.
   */
  async getMany({
    userIds,
    viewer = this.viewerOfRequest(),
  }: {
    userIds: number[];
    viewer?: PresenceViewer;
  }): Promise<Map<number, UserPresence>> {
    const now = new Date();
    const snapshots = await this.snapshots([...new Set(userIds)], now);
    const needsPermission = [...snapshots].some(
      ([id, snapshot]) => snapshot.hideOnlineStatus && id !== viewer.user?.id,
    );
    const canViewHidden = needsPermission
      ? await this.canViewHidden(viewer)
      : false;

    return new Map(
      [...snapshots].map(([id, snapshot]) => [
        id,
        presenceForViewer(
          snapshot,
          { canViewHidden, isSelf: id === viewer.user?.id },
          now,
        ),
      ]),
    );
  }

  /**
   * Keeps one session online for {@link PRESENCE_LEASE_TTL_SECONDS} and, at
   * most once per {@link PRESENCE_PERSIST_INTERVAL_SECONDS}, moves the
   * member's `lastSeenAt` forward. Anonymous members are tracked the same way -
   * hiding changes who may read it, not what is recorded.
   */
  async heartbeat({
    sessionId,
    userId,
  }: {
    sessionId: string;
    userId: number;
  }): Promise<void> {
    await this.c
      .get("cache")
      .renewLease(leaseKey(userId), sessionId, PRESENCE_LEASE_TTL_SECONDS);
    await this.persistLastSeen(userId, new Date());
  }

  /**
   * Ends the given sessions' leases - on sign-out or revocation - leaving the
   * member's other sessions online.
   */
  async removeSessions({
    tokenHashes,
    userId,
  }: {
    tokenHashes: string[];
    userId: number;
  }): Promise<void> {
    if (tokenHashes.length === 0) return;

    const sessionIds = await Promise.all(tokenHashes.map(presenceSessionId));
    await this.c.get("cache").releaseLeases(leaseKey(userId), sessionIds);
  }

  /** The signed-in member of the public site, checked as a moderator. */
  viewerOfRequest(): PresenceViewer {
    return { type: "moderator", user: this.c.get("user") };
  }
}
