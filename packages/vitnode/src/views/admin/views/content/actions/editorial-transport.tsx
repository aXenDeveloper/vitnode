import React from "react";

import type { ContentId } from "@/content/ids";
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
  itemId: ContentId;
  scope: ContentEditorialWriteScope;
}

export interface ContentEditorialTransport {
  /** Cancels one pending schedule. Already-run schedules cannot be cancelled. */
  cancelSchedule: (
    contentTypeId: string,
    itemId: ContentId,
    scheduleId: number,
  ) => Promise<ContentMutationResult>;

  createPreview: (
    contentTypeId: string,
    itemId: ContentId,
  ) => Promise<ContentPreviewResult>;
  /** One revision's snapshot, read when a row is expanded and not before. */
  getRevision: (
    contentTypeId: string,
    itemId: ContentId,
    revisionId: number,
  ) => Promise<{ error?: string; revision?: ContentRevisionDetail }>;

  listRevisions: (
    contentTypeId: string,
    itemId: ContentId,
    cursor?: number,
  ) => Promise<ContentRevisionPageResult>;
  /** Every schedule on one record, and whether anything will run them. */
  listSchedules: (
    contentTypeId: string,
    itemId: ContentId,
  ) => Promise<ContentScheduleListResult>;

  readDelivery: (
    contentTypeId: string,
    itemId: ContentId,
    locale?: string,
  ) => Promise<ContentDeliveryPanelResult>;

  restoreRevision: (
    contentTypeId: string,
    itemId: ContentId,
    revisionId: number,
    expectedVersion: number,
  ) => Promise<ContentMutationResult>;
  /** Books a publication or an unpublication for a moment in the future. */
  schedule: (
    contentTypeId: string,
    itemId: ContentId,
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
