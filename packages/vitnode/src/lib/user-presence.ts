/** How often an open, visible tab tells the API its member is still around. */
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 60_000;

/** How long one heartbeat keeps a session online. */
export const PRESENCE_LEASE_TTL_SECONDS = 150;

/** `lastSeenAt` is written to the database at most this often per member. */
export const PRESENCE_PERSIST_INTERVAL_SECONDS = 60;

/** The most user IDs one batch request may ask about. */
export const PRESENCE_BATCH_MAX_USERS = 100;

export type UserPresence =
  | {
      isHidden?: true;
      lastSeenAt: null | string;
      status: "offline";
    }
  | {
      isHidden?: true;
      lastSeenAt: string;
      status: "online";
    }
  | { status: "hidden" };

export type UserPresenceStatus = UserPresence["status"];

/**
 * What a member's roles say about **Browse anonymously**: they choose
 * (`allowed`), they are always hidden (`forced`), or they can't hide
 * (`disallowed`).
 */
export type BrowseAnonymouslyPolicy = "allowed" | "disallowed" | "forced";

export const BROWSE_ANONYMOUSLY_POLICIES = [
  "allowed",
  "disallowed",
  "forced",
] as const satisfies readonly BrowseAnonymouslyPolicy[];

/** The two role settings that decide {@link BrowseAnonymouslyPolicy}. */
export interface RoleBrowseAnonymouslyRules {
  /** Members may turn Browse anonymously on themselves. Default `true`. */
  allowBrowseAnonymously: boolean;
  /** Members are always hidden, whatever they chose. Default `false`. */
  forceBrowseAnonymously: boolean;
}

/**
 * One member's policy from every role they hold, primary and secondary. A
 * single forcing role wins; otherwise every role has to allow it, like the
 * other self-service role settings. A member with no roles may choose.
 */
export const browseAnonymouslyPolicyOf = (
  roles: readonly RoleBrowseAnonymouslyRules[],
): BrowseAnonymouslyPolicy => {
  if (roles.some(role => role.forceBrowseAnonymously)) return "forced";

  return roles.every(role => role.allowBrowseAnonymously)
    ? "allowed"
    : "disallowed";
};

/**
 * Whether a member's presence is hidden from other members: always when their
 * roles force it, never when their roles disallow it, otherwise their own
 * `hideOnlineStatus` choice.
 */
export const isPresenceHidden = (
  policy: BrowseAnonymouslyPolicy,
  hideOnlineStatus: boolean,
): boolean => policy === "forced" || (policy === "allowed" && hideOnlineStatus);

/** What the server knows about one member, before anyone is asked who is looking. */
export interface UserPresenceSnapshot {
  /** Hidden from other members - their choice, after their roles' policy. */
  hideOnlineStatus: boolean;
  lastSeenAt: Date | null;
  online: boolean;
}

/**
 * The one privacy rule every presence read goes through.
 *
 * A member who browses anonymously reads as `hidden` to everybody except
 * themselves and staff allowed to see hidden presence - and those two get the
 * real answer, flagged `isHidden`, so they know nobody else sees it.
 */
export const presenceForViewer = (
  snapshot: UserPresenceSnapshot,
  { canViewHidden, isSelf }: { canViewHidden: boolean; isSelf: boolean },
  now: Date = new Date(),
): UserPresence => {
  if (snapshot.hideOnlineStatus && !(isSelf || canViewHidden)) {
    return { status: "hidden" };
  }

  const flag = snapshot.hideOnlineStatus ? { isHidden: true as const } : {};

  if (snapshot.online) {
    return {
      ...flag,
      lastSeenAt: (snapshot.lastSeenAt ?? now).toISOString(),
      status: "online",
    };
  }

  return {
    ...flag,
    lastSeenAt: snapshot.lastSeenAt?.toISOString() ?? null,
    status: "offline",
  };
};
