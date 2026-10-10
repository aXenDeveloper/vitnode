import React from "react";

import type { ContentDrafts } from "@/content/live/http";
import type {
  ContentFieldLock,
  ContentLiveMember,
  ContentLiveResetReason,
  ContentLiveRoomRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import {
  CONTENT_LIVE_HEARTBEAT_MS,
  CONTENT_LIVE_POLL_MS,
  contentLiveChannel,
  sameContentLiveRoom,
} from "@/content/live/protocol";
import { useVitNodeWebSocket } from "@/ws/use-websocket";

import { useContentFormTransport } from "../form/transport";

export interface ContentLiveDraftEvent {
  by: null | { id: number; name: string };
  locale: null | string;
  updatedAt: string;
  values: Record<string, unknown>;
}

export type { ContentLiveResetReason } from "@/content/live/protocol";

export interface ContentLiveSession {
  clientId: string;
  focus: (field: null | string, locale: null | string) => void;
  live: boolean;
  locks: ContentFieldLock[];
  members: ContentLiveMember[];
  onCommitted: (listener: () => void) => () => void;
  onDraft: (listener: (event: ContentLiveDraftEvent) => void) => () => void;
  onReset: (listener: (reason: ContentLiveResetReason) => void) => () => void;
  readDrafts: () => Promise<ContentDrafts | null>;
  readyState: number;
  refreshLocks: () => Promise<void>;
  rememberSelf: (userId: number) => void;
  resetLocally: (reason: ContentLiveResetReason) => void;
  self: null | number;
}

const newClientId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const draftKey = (locale: null | string): string => locale ?? "";

const draftEvents = (drafts: ContentDrafts): ContentLiveDraftEvent[] => [
  ...(drafts.shared
    ? [
        {
          by: drafts.shared.updatedBy,
          locale: null,
          updatedAt: drafts.shared.updatedAt,
          values: drafts.shared.values,
        },
      ]
    : []),
  ...Object.entries(drafts.translations).map(([locale, draft]) => ({
    by: draft.updatedBy,
    locale,
    updatedAt: draft.updatedAt,
    values: draft.values,
  })),
];

export const useContentLiveSession = ({
  contentTypeId,
  itemId,
  locale,
}: ContentLiveRoomRef & { locale: null | string }): ContentLiveSession => {
  const transport = useContentFormTransport();
  const [clientId] = React.useState(newClientId);
  const room = React.useMemo(
    () => ({ contentTypeId, itemId }),
    [contentTypeId, itemId],
  );

  const [joined, setJoined] = React.useState(false);
  const [members, setMembers] = React.useState<ContentLiveMember[]>([]);
  const [locks, setLocks] = React.useState<ContentFieldLock[]>([]);
  const [self, setSelf] = React.useState<null | number>(null);

  const draftListenersRef = React.useRef(
    new Set<(event: ContentLiveDraftEvent) => void>(),
  );
  const resetListenersRef = React.useRef(
    new Set<(reason: ContentLiveResetReason) => void>(),
  );
  const committedListenersRef = React.useRef(new Set<() => void>());
  const seenDraftsRef = React.useRef(new Map<string, string>());
  const focusedRef = React.useRef<null | {
    field: null | string;
    locale: null | string;
  }>(null);
  const languageRef = React.useRef(locale);
  const joiningRef = React.useRef(false);
  const joinedRef = React.useRef(false);

  const emitDraft = React.useCallback((event: ContentLiveDraftEvent) => {
    seenDraftsRef.current.set(draftKey(event.locale), event.updatedAt);
    for (const listener of draftListenersRef.current) listener(event);
  }, []);

  const loadLocks = React.useCallback(async () => {
    const result = await transport.listLocks(contentTypeId, itemId);

    return result.error === undefined ? result.locks : null;
  }, [contentTypeId, itemId, transport]);

  const refreshLocks = React.useCallback(async () => {
    const next = await loadLocks();
    if (next) setLocks(next);
  }, [loadLocks]);

  const readDrafts = React.useCallback(async () => {
    const { drafts } = await transport.readDraft(contentTypeId, itemId);
    if (!drafts) return null;

    seenDraftsRef.current = new Map(
      draftEvents(drafts).map(event => [
        draftKey(event.locale),
        event.updatedAt,
      ]),
    );

    return drafts;
  }, [contentTypeId, itemId, transport]);

  const pollDrafts = React.useCallback(async () => {
    const { drafts } = await transport.readDraft(contentTypeId, itemId);
    if (!drafts) return;

    for (const event of draftEvents(drafts)) {
      if (
        seenDraftsRef.current.get(draftKey(event.locale)) !== event.updatedAt
      ) {
        emitDraft(event);
      }
    }
  }, [contentTypeId, emitDraft, itemId, transport]);

  const onMessage = (message: ContentLiveServerMessage) => {
    switch (message.type) {
      case "committed":
        if (!sameContentLiveRoom(message.room, room)) return;
        for (const listener of committedListenersRef.current) listener();

        return;
      case "draft":
        if (!sameContentLiveRoom(message.room, room)) return;
        emitDraft({
          by: message.by,
          locale: message.locale,
          updatedAt: message.updatedAt,
          values: message.values,
        });

        return;
      case "error":
        if (message.clientId !== clientId) return;
        if (message.room && !sameContentLiveRoom(message.room, room)) return;

        if (message.code === "NOT_JOINED") {
          if (!joiningRef.current && readyStateRef.current === 1) {
            joiningRef.current = true;
            send({ clientId, locale: languageRef.current, room, type: "join" });
          }

          return;
        }
        if (message.code === "INVALID_MESSAGE") return;
        if (message.code === "NOT_FOUND" && joinedRef.current) return;

        joiningRef.current = false;
        setJoined(false);

        return;
      case "joined": {
        if (
          message.clientId !== clientId ||
          !sameContentLiveRoom(message.room, room)
        ) {
          return;
        }
        joiningRef.current = false;
        setJoined(true);
        setMembers(message.members);
        const me = message.members.find(member => member.clientId === clientId);
        if (me) setSelf(me.userId);

        return;
      }
      case "locks":
        if (sameContentLiveRoom(message.room, room)) setLocks(message.locks);

        return;
      case "presence":
        if (sameContentLiveRoom(message.room, room)) {
          setMembers(message.members);
        }

        return;
      case "reset":
        if (!sameContentLiveRoom(message.room, room)) return;
        for (const listener of resetListenersRef.current) {
          listener(message.reason);
        }

        return;
      default:
        return;
    }
  };

  const { readyState, send } = useVitNodeWebSocket(contentLiveChannel, {
    onMessage,
  });
  const readyStateRef = React.useRef(readyState);
  React.useEffect(() => {
    readyStateRef.current = readyState;
  }, [readyState]);

  React.useEffect(() => {
    if (readyState !== 1) return;

    joiningRef.current = true;
    send({ clientId, locale: languageRef.current, room, type: "join" });

    return () => {
      joiningRef.current = false;
      setJoined(false);
    };
  }, [clientId, readyState, room, send]);

  React.useEffect(() => {
    const leave = () => {
      send({ clientId, room, type: "leave" });
    };
    window.addEventListener("pagehide", leave);

    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [clientId, room, send]);

  const live = joined && readyState === 1;
  React.useEffect(() => {
    joinedRef.current = live;
  }, [live]);

  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- `joined` arrives over the socket; this resyncs once per seat
    if (!live) return;

    void loadLocks().then(next => {
      if (next) setLocks(next);
    });
    void pollDrafts();
    if (focusedRef.current) {
      send({ clientId, room, type: "focus", ...focusedRef.current });
    }
  }, [clientId, live, loadLocks, pollDrafts, room, send]);

  React.useEffect(() => {
    if (!live) return;

    const timer = setInterval(() => {
      send({ clientId, room, type: "heartbeat" });
    }, CONTENT_LIVE_HEARTBEAT_MS);

    return () => {
      clearInterval(timer);
    };
  }, [clientId, live, room, send]);

  React.useEffect(() => {
    void loadLocks().then(next => {
      if (next) setLocks(next);
    });
  }, [loadLocks]);

  React.useEffect(() => {
    if (live) return;

    const timer = setInterval(() => {
      void loadLocks().then(next => {
        if (next) setLocks(next);
      });
      void pollDrafts();
    }, CONTENT_LIVE_POLL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [live, loadLocks, pollDrafts]);

  const focus = React.useCallback(
    (field: null | string, fieldLocale: null | string) => {
      if (fieldLocale !== null) languageRef.current = fieldLocale;
      const next = { field, locale: languageRef.current };
      focusedRef.current = next;
      if (readyStateRef.current !== 1) return;

      send({ clientId, room, type: "focus", ...next });
    },
    [clientId, room, send],
  );

  const onDraft = React.useCallback(
    (listener: (event: ContentLiveDraftEvent) => void) => {
      draftListenersRef.current.add(listener);

      return () => {
        draftListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const onCommitted = React.useCallback((listener: () => void) => {
    committedListenersRef.current.add(listener);

    return () => {
      committedListenersRef.current.delete(listener);
    };
  }, []);

  const onReset = React.useCallback(
    (listener: (reason: ContentLiveResetReason) => void) => {
      resetListenersRef.current.add(listener);

      return () => {
        resetListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const resetLocally = React.useCallback((reason: ContentLiveResetReason) => {
    for (const listener of resetListenersRef.current) listener(reason);
  }, []);

  return {
    clientId,
    focus,
    live,
    locks,
    members,
    onCommitted,
    onDraft,
    onReset,
    readDrafts,
    readyState,
    refreshLocks,
    rememberSelf: setSelf,
    resetLocally,
    self,
  };
};
