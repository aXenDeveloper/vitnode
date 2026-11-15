/** The longest edit window a role can set, in minutes: one year. */
export const ROLE_EDIT_OWN_CONTENT_MAX_MINUTES = 60 * 24 * 365;

export interface RoleOwnContentLimits {
  allowDeleteOwnContent: boolean;
  allowEditOwnContent: boolean;
  allowHideOwnContent: boolean;
  /** `null` is unlimited. */
  editOwnContentMinutes: null | number;
}

export interface OwnContentEditPolicy {
  allowed: boolean;
  /** How long after creation an author may edit, or `null` for no limit. */
  minutes: null | number;
}

/** What a member may do with content they wrote. */
export interface OwnContentPolicy {
  delete: boolean;
  edit: OwnContentEditPolicy;
  hide: boolean;
}

const DEFAULT_OWN_CONTENT_POLICY: OwnContentPolicy = {
  delete: false,
  edit: { allowed: true, minutes: null },
  hide: false,
};

/**
 * What a member's roles allow together: the most generous one wins. Each action
 * is allowed when any role allows it, and the longest edit window of those
 * roles applies - an unlimited one beats any number of minutes. No roles at all
 * reads as the column defaults: editing allowed without a limit, deleting and
 * hiding not allowed.
 */
export const effectiveOwnContentPolicy = (
  roles: readonly RoleOwnContentLimits[],
): OwnContentPolicy => {
  if (roles.length === 0) return DEFAULT_OWN_CONTENT_POLICY;

  const editing = roles.filter(role => role.allowEditOwnContent);
  const edit: OwnContentEditPolicy =
    editing.length === 0
      ? { allowed: false, minutes: null }
      : editing.some(role => role.editOwnContentMinutes === null)
        ? { allowed: true, minutes: null }
        : {
            allowed: true,
            minutes: Math.max(
              ...editing.map(role => role.editOwnContentMinutes ?? 0),
            ),
          };

  return {
    delete: roles.some(role => role.allowDeleteOwnContent),
    edit,
    hide: roles.some(role => role.allowHideOwnContent),
  };
};

/** Whether `policy` still lets the author edit a record created at `createdAt`. */
export const ownContentEditOpen = (
  policy: OwnContentEditPolicy,
  createdAt: Date | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!policy.allowed) return false;
  if (policy.minutes === null) return true;
  if (!(createdAt instanceof Date)) return false;

  return now.getTime() - createdAt.getTime() <= policy.minutes * 60_000;
};
