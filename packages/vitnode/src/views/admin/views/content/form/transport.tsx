import React from "react";

import type { ContentId } from "@/content/ids";
import type { ContentVisibilityAction } from "@/content/visibility";

import type {
  ContentMutationResult,
  ContentRowResult,
  ContentTranslationInput,
  TranslationRow,
} from "../content-mutation";
import type { ContentOption } from "../lib/field-component";

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

  edit: (
    contentTypeId: string,
    itemId: ContentId,
    values: Record<string, unknown>,
    expectedVersion?: number,
  ) => Promise<ContentMutationResult>;

  editLocalized: (
    contentTypeId: string,
    itemId: ContentId,
    values: Record<string, unknown> | undefined,
    translations: ContentTranslationInput[],
    expectedVersion?: number,
  ) => Promise<ContentMutationResult>;

  listTranslations: (
    contentTypeId: string,
    itemId: ContentId,
  ) => Promise<{ edges: TranslationRow[]; error?: string }>;

  loadOptions: (
    contentTypeId: string,
    field: string,
    search: string,
    ids?: ContentId[],
  ) => Promise<ContentOption[]>;
  /** Moves a record to `published`. Idempotent: a no-op is a success. */
  publish: (
    contentTypeId: string,
    itemId: ContentId,
  ) => Promise<ContentMutationResult>;

  reloadRow: (
    contentTypeId: string,
    itemId: ContentId,
  ) => Promise<ContentRowResult>;
  /**
   * Hides or unhides a record, for a content type with visibility enabled.
   * `expectedVersion` is the form's own precondition, so a record somebody
   * saved meanwhile answers `409` rather than changing under the editor.
   * Optional: a transport without it renders no Hide / Unhide control.
   */
  setHidden?: (
    contentTypeId: string,
    itemId: ContentId,
    action: ContentVisibilityAction,
    expectedVersion?: number,
  ) => Promise<ContentMutationResult>;
  /** Moves a record back to `draft`. Idempotent, like {@link publish}. */
  unpublish: (
    contentTypeId: string,
    itemId: ContentId,
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
