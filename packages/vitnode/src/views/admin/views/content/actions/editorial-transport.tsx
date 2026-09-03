// No "use client", for the same reason `../form/transport.tsx` has none: this is
// only reached from a client entry, and a nested one cannot be resolved from
// inside a published package.
import React from "react";

import type { ContentRevisionDetail } from "@/content/revisions";
import type { ContentScheduleAction } from "@/content/schedules";

import type { ContentMutationResult } from "../content-mutation";
import type {
  ContentDeliveryPanelResult,
  ContentPreviewResult,
  ContentRevisionPageResult,
  ContentScheduleListResult,
} from "./editorial-api";

export type ContentEditorialWriteScope = "record" | "schedules";

export interface ContentEditorialSettled {
  contentTypeId: string;
  itemId: number;
  scope: ContentEditorialWriteScope;
}

export interface ContentEditorialTransport {
  /** Cancels one pending schedule. Already-run schedules cannot be cancelled. */
  cancelSchedule: (
    contentTypeId: string,
    itemId: number,
    scheduleId: number,
  ) => Promise<ContentMutationResult>;

  createPreview: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentPreviewResult>;
  /** One revision's snapshot, read when a row is expanded and not before. */
  getRevision: (
    contentTypeId: string,
    itemId: number,
    revisionId: number,
  ) => Promise<{ error?: string; revision?: ContentRevisionDetail }>;

  listRevisions: (
    contentTypeId: string,
    itemId: number,
    cursor?: number,
  ) => Promise<ContentRevisionPageResult>;
  /** Every schedule on one record, and whether anything will run them. */
  listSchedules: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentScheduleListResult>;

  readDelivery: (
    contentTypeId: string,
    itemId: number,
    locale?: string,
  ) => Promise<ContentDeliveryPanelResult>;

  restoreRevision: (
    contentTypeId: string,
    itemId: number,
    revisionId: number,
    expectedVersion: number,
  ) => Promise<ContentMutationResult>;
  /** Books a publication or an unpublication for a moment in the future. */
  schedule: (
    contentTypeId: string,
    itemId: number,
    action: ContentScheduleAction,
    scheduledFor: string,
  ) => Promise<ContentMutationResult>;

  settled: (args: ContentEditorialSettled) => Promise<void> | void;
}

const ContentEditorialTransportContext =
  React.createContext<ContentEditorialTransport | null>(null);

export const ContentEditorialTransportProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ContentEditorialTransport;
}) => (
  <ContentEditorialTransportContext.Provider value={value}>
    {children}
  </ContentEditorialTransportContext.Provider>
);

export const CONTENT_EDITORIAL_TRANSPORT_MISSING =
  "A Content Engine editorial panel must be rendered inside a ContentEditorialTransportProvider. A TanStack Start route mounts one in ContentEditorialHost.";

export const useContentEditorialTransport = (): ContentEditorialTransport => {
  const transport = React.use(ContentEditorialTransportContext);

  if (!transport) throw new Error(CONTENT_EDITORIAL_TRANSPORT_MISSING);

  return transport;
};
