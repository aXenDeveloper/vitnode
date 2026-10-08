import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";

import type { ContentLiveSession } from "./use-session";

export interface ContentLiveAutosaveStatus {
  /** The draft holds values the record does not: `Save` has work to do. */
  dirty: boolean;
  /** The last autosave was refused or never arrived. */
  failed: boolean;
  /** When this tab's last autosave landed, as an ISO string. */
  savedAt: null | string;
  saving: boolean;
}

export interface ContentLiveContextValue {
  autosave: {
    /** Saves whatever is waiting now, rather than after the debounce. */
    flush: () => Promise<void>;
    /** Schedules one field's API value for the next autosave. */
    queue: (field: string, locale: null | string, value: unknown) => void;
  };
  /** The record the session is for. */
  itemId: number;
  /** The language a localized field locks in when the layout pins none. */
  locale: null | string;
  session: ContentLiveSession;
  spec: ContentFormSpec;
  status: ContentLiveAutosaveStatus;
}

export const ContentLiveContext =
  React.createContext<ContentLiveContextValue | null>(null);

/**
 * The live editing session of the record the form edits: who is in it, who
 * holds which field, and the autosave status. `null` outside a live form - a
 * create form, or a content type without editorial versions.
 */
export const useContentLive = (): ContentLiveContextValue | null =>
  React.use(ContentLiveContext);
