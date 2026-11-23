import type { ContentPublicPerson } from "@vitnode/api/content/public-person";

import React from "react";

import type { ChatListFilter } from "./query";

/** What the chat dock shows. */
export type ChatDockView =
  | { chatId: number; type: "chat" }
  | { people: ContentPublicPerson[]; type: "new" }
  | { type: "list" };

export interface ChatDockState {
  filter: ChatListFilter;
  open: boolean;
  view: ChatDockView;
}

const STORAGE_KEY = "vitnode-chat-dock";
const INITIAL: ChatDockState = {
  filter: "all",
  open: false,
  view: { type: "list" },
};

const read = (): ChatDockState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<ChatDockState>;

    return {
      filter: parsed.filter ?? "all",
      open: parsed.open === true,
      view:
        parsed.view?.type === "chat" && typeof parsed.view.chatId === "number"
          ? parsed.view
          : { type: "list" },
    };
  } catch {
    return INITIAL;
  }
};

let state: ChatDockState | null = null;
const listeners = new Set<() => void>();

const current = (): ChatDockState => {
  state ??= typeof window === "undefined" ? INITIAL : read();

  return state;
};

/** Changes the dock; remembered for the tab's session. Browser-only. */
export const setChatDock = (
  next: ((previous: ChatDockState) => ChatDockState) | Partial<ChatDockState>,
): void => {
  const previous = current();
  state =
    typeof next === "function" ? next(previous) : { ...previous, ...next };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the dock just forgets on reload.
  }
  for (const listener of listeners) listener();
};

/** Opens the dock on one chat, or on a new chat with `people`. */
export const openChatDock = (view: ChatDockView = { type: "list" }): void => {
  setChatDock({ open: true, view });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/** The dock's state, shared by the header button and the dock. */
export const useChatDock = (): ChatDockState =>
  React.useSyncExternalStore(subscribe, current, () => INITIAL);

const DOCK_QUERY = "(min-width: 1024px)";

const subscribeMedia = (listener: () => void) => {
  const media = window.matchMedia(DOCK_QUERY);
  media.addEventListener("change", listener);

  return () => {
    media.removeEventListener("change", listener);
  };
};

/** The screen is wide enough for the dock; below it chat opens as a page. */
export const useDockAvailable = (): boolean =>
  React.useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(DOCK_QUERY).matches,
    () => false,
  );
