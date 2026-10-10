import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";

import type { ContentRichTextRegistry } from "./rich-text";
import type { ContentLiveSession } from "./use-session";

export interface ContentLiveAutosaveStatus {
  dirty: boolean;
  failed: boolean;
  savedAt: null | string;
  saving: boolean;
}

export interface ContentLiveContextValue {
  autosave: {
    flush: () => Promise<void>;
    queue: (field: string, locale: null | string, value: unknown) => void;
  };
  coEditing: boolean;
  discard: () => Promise<boolean>;
  itemId: number;
  locale: null | string;
  reloadDrafts: () => Promise<void>;
  richText: ContentRichTextRegistry;
  session: ContentLiveSession;
  spec: ContentFormSpec;
  status: ContentLiveAutosaveStatus;
}

export const ContentLiveContext =
  React.createContext<ContentLiveContextValue | null>(null);

export const useContentLive = (): ContentLiveContextValue | null =>
  React.use(ContentLiveContext);
