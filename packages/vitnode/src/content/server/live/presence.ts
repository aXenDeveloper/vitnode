import type {
  ContentLiveMember,
  ContentLiveRoomRef,
} from "@/content/live/protocol";

import {
  CONTENT_LIVE_MEMBER_TIMEOUT_MS,
  contentLiveRoom,
} from "@/content/live/protocol";

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

export const createContentLivePresence = <TConnection>({
  deliver,
  now = Date.now,
  publish,
}: {
  deliver: (room: ContentLiveRoomRef, members: ContentLiveMember[]) => void;
  now?: () => number;
  publish: (snapshot: ContentLivePresenceSnapshot) => void;
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
        instances.set(origin, {
          expiresAt: now() + CONTENT_LIVE_MEMBER_TIMEOUT_MS,
          members,
        });
        remote.set(key, instances);
      }

      deliverRoom(key);
      forget(key);

      return isNew && members.length > 0;
    },
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
    hasUser: (room: ContentLiveRoomRef, userId: number): boolean =>
      [...(local.get(contentLiveRoom(room))?.values() ?? [])].some(
        entry => entry.member.userId === userId,
      ),
    heartbeat: (room: ContentLiveRoomRef, clientId: string): boolean => {
      const entry = local.get(contentLiveRoom(room))?.get(clientId);
      if (!entry) return false;
      entry.lastSeen = now();

      return true;
    },
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
    localMembers: (): ContentLiveLocalMember<TConnection>[] =>
      [...local.values()].flatMap(members => [...members.values()]),
    membersOf,
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
    sweep: (): ContentLiveLocalMember<TConnection>[] => {
      const at = now();
      const removed: ContentLiveLocalMember<TConnection>[] = [];

      for (const [key, members] of [...local]) {
        for (const [clientId, entry] of [...members]) {
          if (at - entry.lastSeen < CONTENT_LIVE_MEMBER_TIMEOUT_MS) continue;
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
