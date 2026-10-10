import React from "react";

import type { ContentDrafts } from "@/content/live/http";
import type { ContentFieldLock } from "@/content/live/protocol";

import type {
  ContentMutationResult,
  ContentRowResult,
  ContentTranslationInput,
  TranslationRow,
} from "../content-mutation";
import type { ContentOption } from "../lib/field-component";
import type {
  ContentDraftSaveResult,
  ContentFieldLockAction,
  ContentFieldLockResult,
} from "../live/api";

export interface ContentFormTransport {
  /** Creates a record from the shared fields alone. */
  create: (
    contentTypeId: string,
    values: Record<string, unknown>,
  ) => Promise<ContentMutationResult>;

  createLocalized: (
    contentTypeId: string,
    values: Record<string, unknown>,
    translations: ContentTranslationInput[],
  ) => Promise<ContentMutationResult>;

  discardDraft: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<{ error?: string; status: number }>;

  edit: (
    contentTypeId: string,
    itemId: number,
    values: Record<string, unknown>,
    expectedVersion?: number,
  ) => Promise<ContentMutationResult>;

  editLocalized: (
    contentTypeId: string,
    itemId: number,
    values: Record<string, unknown> | undefined,
    translations: ContentTranslationInput[],
    expectedVersion?: number,
  ) => Promise<ContentMutationResult>;

  listLocks: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<{ error?: string; locks: ContentFieldLock[] }>;

  listTranslations: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<{ edges: TranslationRow[]; error?: string }>;

  loadOptions: (
    contentTypeId: string,
    field: string,
    search: string,
    ids?: number[],
  ) => Promise<ContentOption[]>;
  lock: (
    contentTypeId: string,
    itemId: number,
    request: {
      action: ContentFieldLockAction;
      field: string;
      locale: null | string;
    },
  ) => Promise<ContentFieldLockResult>;

  /** Moves a record to `published`. Idempotent: a no-op is a success. */
  publish: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentMutationResult>;

  readDraft: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<{ drafts?: ContentDrafts; error?: string }>;

  reloadRow: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentRowResult>;

  saveDraft: (
    contentTypeId: string,
    itemId: number,
    draft: { locale: null | string; values: Record<string, unknown> },
  ) => Promise<ContentDraftSaveResult>;
  /** Moves a record back to `draft`. Idempotent, like {@link publish}. */
  unpublish: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentMutationResult>;
}

const ContentFormTransportContext =
  React.createContext<ContentFormTransport | null>(null);

export const ContentFormTransportProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ContentFormTransport;
}) => (
  <ContentFormTransportContext.Provider value={value}>
    {children}
  </ContentFormTransportContext.Provider>
);

export const CONTENT_FORM_TRANSPORT_MISSING =
  "A Content Engine form must be rendered inside a ContentFormTransportProvider. A TanStack Start route mounts one in ContentFormHost.";

export const useContentFormTransport = (): ContentFormTransport => {
  const transport = React.use(ContentFormTransportContext);

  if (!transport) throw new Error(CONTENT_FORM_TRANSPORT_MISSING);

  return transport;
};
