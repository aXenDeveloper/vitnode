// No "use client": reached only from `content-form`, which is itself only
// reached from a client entry. Declaring it again would make this a nested
// client entry, which `next/dynamic` cannot resolve from inside a package.
import React from "react";

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
  /** Moves a record to `published`. Idempotent: a no-op is a success. */
  publish: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentMutationResult>;

  reloadRow: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentRowResult>;
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
