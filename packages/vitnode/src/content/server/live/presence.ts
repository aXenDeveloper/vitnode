import type {
  ContentLiveMember,
  ContentLiveRoomRef,
} from "@/content/live/protocol";

import {
  CONTENT_LIVE_MEMBER_TIMEOUT_MS,
  contentLiveRoom,
} from "@/content/live/protocol";

/** One instance's members of one record room, as it tells the others. */
export interface ContentLivePresenceSnapshot {
  members: ContentLiveMember[];
  room: ContentLiveRoomRef;
}

export interface ContentLiveLocalMember<TConnection> {
  connection: TConnection;
  lastSeen: number;
  member: ContentLiveMember;
  room: ContentLiveRoomRef;
}

/**
 * Who is in which record, on this instance and on the others.
 *
 * Local members are keyed by `clientId` (one per browser tab) and expire when
 * their heartbeats stop. Members of other instances arrive as snapshots, one
 * per instance and room, and expire when that instance stops refreshing them,
 * so a crashed instance cannot leave ghosts behind. Every change is delivered
 * to this instance's sockets as the union of both.
 */
export const createContentLivePresence = <TConnection>({
  deliver,
  now = Date.now,
  publish,
  timeoutMs = CONTENT_LIVE_MEMBER_TIMEOUT_MS,
}: {
  /** Send the room's member list to the sockets of this instance. */
  deliver: (room: ContentLiveRoomRef, members: ContentLiveMember[]) => void;
  now?: () => number;
  /** Tell the other instances who is in a room here. */
  publish: (snapshot: ContentLivePresenceSnapshot) => void;
  timeoutMs?: number;
}) => {
  const refs = new Map<string, ContentLiveRoomRef>();
  const local = new Map<
    string,
    Map<string, ContentLiveLocalMember<TConnection>>
  >();
  const remote = new Map<
    string,
    Map<string, { expiresAt: number; members: ContentLiveMember[] }>
  >();

  const forget = (key: string): void => {
    if (!local.has(key) && !remote.has(key)) refs.delete(key);
  };

  const localMembers = (key: string): ContentLiveMember[] =>
    [...(local.get(key)?.values() ?? [])].map(entry => entry.member);

  const membersOf = (room: ContentLiveRoomRef): ContentLiveMember[] => {
    const key = contentLiveRoom(room);
    const members = localMembers(key);
    const seen = new Set(members.map(member => member.clientId));

    for (const snapshot of remote.get(key)?.values() ?? []) {
      for (const member of snapshot.members) {
        if (seen.has(member.clientId)) continue;
        seen.add(member.clientId);
        members.push(member);
      }
    }

    return members;
  };

  const deliverRoom = (key: string): void => {
    const room = refs.get(key);
    if (room) deliver(room, membersOf(room));
  };

  const announce = (key: string): void => {
    const room = refs.get(key);
    if (!room) return;
    deliver(room, membersOf(room));
    publish({ members: localMembers(key), room });
  };

  const removeLocal = (
    key: string,
    clientId: string,
  ): ContentLiveLocalMember<TConnection> | undefined => {
    const members = local.get(key);
    const entry = members?.get(clientId);
    if (!members || !entry) return undefined;

    members.delete(clientId);
    if (members.size === 0) local.delete(key);
    announce(key);
    forget(key);

    return entry;
  };

  return {
    /** Apply another instance's snapshot. Returns whether that instance is new to the room. */
    applyRemote: (
      origin: string,
      { members, room }: ContentLivePresenceSnapshot,
    ): boolean => {
      const key = contentLiveRoom(room);
      const instances =
        remote.get(key) ??
        new Map<string, { expiresAt: number; members: ContentLiveMember[] }>();
      const isNew = !instances.has(origin);

      if (members.length === 0) {
        if (isNew) return false;
        instances.delete(origin);
        if (instances.size === 0) remote.delete(key);
      } else {
        refs.set(key, room);
        instances.set(origin, { expiresAt: now() + timeoutMs, members });
        remote.set(key, instances);
      }

      deliverRoom(key);
      forget(key);

      return isNew && members.length > 0;
    },
    /** Update the field and language a member is in. `false` if it is not here. */
    focus: (
      room: ContentLiveRoomRef,
      clientId: string,
      { field, locale }: Pick<ContentLiveMember, "field" | "locale">,
    ): boolean => {
      const key = contentLiveRoom(room);
      const entry = local.get(key)?.get(clientId);
      if (!entry) return false;

      entry.lastSeen = now();
      if (entry.member.field === field && entry.member.locale === locale) {
        return true;
      }
      entry.member = { ...entry.member, field, locale };
      announce(key);

      return true;
    },
    get: (
      room: ContentLiveRoomRef,
      clientId: string,
    ): ContentLiveLocalMember<TConnection> | undefined =>
      local.get(contentLiveRoom(room))?.get(clientId),
    /** Whether `userId` still has a member (tab) in the room on this instance. */
    hasUser: (room: ContentLiveRoomRef, userId: number): boolean =>
      [...(local.get(contentLiveRoom(room))?.values() ?? [])].some(
        entry => entry.member.userId === userId,
      ),
    /** Keep a member alive. `false` if it is not here. */
    heartbeat: (room: ContentLiveRoomRef, clientId: string): boolean => {
      const entry = local.get(contentLiveRoom(room))?.get(clientId);
      if (!entry) return false;
      entry.lastSeen = now();

      return true;
    },
    /** Add or replace a member. Returns the room's members afterwards. */
    join: ({
      connection,
      member,
      room,
    }: {
      connection: TConnection;
      member: ContentLiveMember;
      room: ContentLiveRoomRef;
    }): ContentLiveMember[] => {
      const key = contentLiveRoom(room);
      refs.set(key, room);
      const members =
        local.get(key) ??
        new Map<string, ContentLiveLocalMember<TConnection>>();
      local.set(key, members);
      members.set(member.clientId, {
        connection,
        lastSeen: now(),
        member,
        room,
      });
      announce(key);

      return membersOf(room);
    },
    /** Every local member, for a socket that closed. */
    localMembers: (): ContentLiveLocalMember<TConnection>[] =>
      [...local.values()].flatMap(members => [...members.values()]),
    membersOf,
    /**
     * Re-send this instance's snapshot of every room it has members in, or of
     * one room only.
     */
    refresh: (only?: ContentLiveRoomRef): void => {
      const onlyKey = only ? contentLiveRoom(only) : undefined;
      for (const [key, members] of local) {
        const room = refs.get(key);
        if (room && (onlyKey === undefined || onlyKey === key)) {
          publish({
            members: [...members.values()].map(entry => entry.member),
            room,
          });
        }
      }
    },
    remove: (
      room: ContentLiveRoomRef,
      clientId: string,
    ): ContentLiveLocalMember<TConnection> | undefined =>
      removeLocal(contentLiveRoom(room), clientId),
    /**
     * Drop local members whose heartbeats stopped and other instances'
     * snapshots that were not refreshed. Returns the local members removed.
     */
    sweep: (): ContentLiveLocalMember<TConnection>[] => {
      const at = now();
      const removed: ContentLiveLocalMember<TConnection>[] = [];

      for (const [key, members] of [...local]) {
        for (const [clientId, entry] of [...members]) {
          if (at - entry.lastSeen < timeoutMs) continue;
          const gone = removeLocal(key, clientId);
          if (gone) removed.push(gone);
        }
      }

      for (const [key, instances] of [...remote]) {
        let changed = false;
        for (const [origin, snapshot] of [...instances]) {
          if (snapshot.expiresAt > at) continue;
          instances.delete(origin);
          changed = true;
        }
        if (instances.size === 0) remote.delete(key);
        if (changed) {
          deliverRoom(key);
          forget(key);
        }
      }

      return removed;
    },
  };
};

export type ContentLivePresence<TConnection> = ReturnType<
  typeof createContentLivePresence<TConnection>
>;
