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

/**
 * Every call a Content Engine **editorial panel** makes, and nothing else.
 *
 * The counterpart of `../form/transport.tsx`, one screen over. The form's seam
 * covers creating, editing and publishing a record; this covers the four things
 * that hang off a row and have nothing to do with a form:
 *
 *     history     list revisions, read one, restore one
 *     schedule    list, book, cancel
 *     preview     mint a signed draft link
 *     delivery    read the canonical path and the URL history
 *
 *     Next.js AdminCP          this interface          TanStack Start AdminCP
 *     -----------------------------------------------------------------------
 *     "use server" actions  →  listRevisions/…   ←   fetch → Hono
 *     revalidatePath()         (the panels)          router.invalidate()
 *
 * ## `settled` is the only member that is not a request
 *
 * Everything a host has to do *after* an editorial write that committed, named
 * once so the panels never have to know which host they are in. The two are not
 * the same work and neither is expressible in the other's terms: Next.js has
 * already expired the cached route segment inside the Server Action, and what is
 * left for the client is the query entries this panel reads; TanStack Start has
 * no segment cache and has to expire the query entries *and* re-run the route's
 * loader. Both are spelled by their own host, and both are asked for the same
 * way.
 *
 * The **scope** is passed rather than inferred because the right answer differs
 * per write and always narrows: a restore changes the record, its history and
 * possibly its delivery address; booking a schedule changes only the schedules
 * and the pending badge on the row. Invalidating everything under the record for
 * both would refetch a revision list nobody asked to reload.
 *
 * ## Why it is a context and not a module-level registration
 *
 * Same reason `ContentFormTransport` is: the TanStack implementation closes over
 * the request's `QueryClient`, which is per-render and must never be shared
 * between two visitors being server-rendered at once. React context is the only
 * place a per-request value can live safely.
 */

/**
 * What an editorial write moved, so the host expires exactly that.
 *
 * `record` is the widest and is still one record: it means the row itself
 * changed - its version, its fields, its address - so the list, the record and
 * everything under it are stale. The other two are narrower and name themselves.
 */
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
  /**
   * Mints a signed preview link for the current draft.
   *
   * A `503` means the installation has no preview secret configured, which is
   * the one failure the panel words differently - it is a deployment fact rather
   * than something the administrator did.
   */
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
  /**
   * One page of revision metadata, newest first.
   *
   * `cursor` is the last **version** on the previous page and the route is
   * exclusive on it, so pages append cleanly and never repeat their boundary row.
   */
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
  /**
   * One record's canonical path and the addresses it used to answer to.
   *
   * `locale` names the *translation* whose address is wanted, and is absent for
   * a content type with no translations. See `contentDeliveryRequestLocale`.
   */
  readDelivery: (
    contentTypeId: string,
    itemId: number,
    locale?: string,
  ) => Promise<ContentDeliveryPanelResult>;
  /**
   * Restores one revision onto the record, guarded on the version it is at now.
   *
   * A mismatch is a `409` carrying `CONTENT_VERSION_CONFLICT` - somebody saved
   * between the panel opening and the button being pressed - and the result
   * carries the version the record holds afterwards so the still-open dialog can
   * guard its next restore on it.
   */
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
  /**
   * Makes the AdminCP reflect an editorial write that has already committed.
   *
   * Called only on success. A refused write left the record exactly where it
   * was, and refetching underneath a dialog that is still open - still naming
   * the revision somebody is being asked about - would replace what they are
   * looking at while they decide.
   */
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

/**
 * The message a caller gets when a host forgot to mount the provider.
 *
 * A named constant so a test can assert on it without matching English, and so
 * the sentence says what to do rather than what went wrong.
 */
export const CONTENT_EDITORIAL_TRANSPORT_MISSING =
  "A Content Engine editorial panel must be rendered inside a ContentEditorialTransportProvider. A TanStack Start route mounts one in ContentEditorialHost.";

export const useContentEditorialTransport = (): ContentEditorialTransport => {
  const transport = React.use(ContentEditorialTransportContext);

  if (!transport) throw new Error(CONTENT_EDITORIAL_TRANSPORT_MISSING);

  return transport;
};
