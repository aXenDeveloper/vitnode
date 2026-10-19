import type { RichTextDocument } from "@/content/rich-text/document";
import type { ModerationReportReason } from "@/lib/moderation/const";

import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

const REPORTED_FAILURES = [
  "already_claimed",
  "assignee_not_eligible",
  "conflict",
  "duplicate",
  "forbidden",
  "not_found",
  "note_not_found",
  "rate_limited",
  "report_closed",
  "report_open",
  "target_gone",
] as const;

export type ModerationFailure =
  | "unauthenticated"
  | "unknown"
  | "validation"
  | (typeof REPORTED_FAILURES)[number];

export type ModerationResult<T> =
  | { data: T; ok: true }
  | { failure: ModerationFailure; ok: false };

const isReportedFailure = (
  value: unknown,
): value is (typeof REPORTED_FAILURES)[number] =>
  REPORTED_FAILURES.some(failure => failure === value);

const reportedFailureOf = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as null | {
    error?: unknown;
  };

  return isReportedFailure(body?.error) ? body.error : null;
};

const failureOf = async (response: Response): Promise<ModerationFailure> => {
  if (response.status === 429) return "rate_limited";
  const reported = await reportedFailureOf(response);
  if (reported) return reported;
  if (response.status === 400) return "validation";
  if (response.status === 401) return "unauthenticated";
  if (response.status === 403) return "forbidden";
  if (response.status === 404) return "not_found";

  return "unknown";
};

const settle = async <T>(
  request: () => Promise<Response>,
  expected: number,
): Promise<ModerationResult<T>> => {
  try {
    const response = await request();
    if (response.status !== expected) {
      return { failure: await failureOf(response), ok: false };
    }

    return { data: (await response.json()) as T, ok: true };
  } catch {
    return { failure: "unknown", ok: false };
  }
};

const options = { credentials: "include" } as const;

export interface CreateReportInput {
  description: null | string;
  locale: null | string;
  pluginId: string;
  reason: ModerationReportReason;
  requestedLocale?: null | string;
  targetId: string;
  targetType: string;
}

export const createReport = async (input: CreateReportInput) =>
  await settle<{ id: number }>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: input },
        method: "post",
        module: "moderation",
        options,
        path: "/reports",
      }),
    201,
  );

export interface ReportState {
  assigneeId: null | number;
  status: "done" | "in_progress" | "new";
  version: number;
}

export const claimReport = async ({
  expectedVersion,
  id,
}: {
  expectedVersion: number;
  id: number;
}) =>
  await settle<ReportState>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { expectedVersion }, params: { id } },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/claim",
      }),
    200,
  );

export const assignReport = async ({
  assigneeId,
  expectedVersion,
  id,
}: {
  assigneeId: null | number;
  expectedVersion: number;
  id: number;
}) =>
  await settle<ReportState>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { assigneeId, expectedVersion }, params: { id } },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/assign",
      }),
    200,
  );

export const addReportNote = async ({
  body,
  id,
}: {
  body: RichTextDocument | string;
  id: number;
}) =>
  await settle<{ ok: boolean }>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { body }, params: { id } },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/notes",
      }),
    201,
  );

export const editReportNote = async ({
  body,
  id,
  noteId,
}: {
  body: RichTextDocument | string;
  id: number;
  noteId: number;
}) =>
  await settle<{ ok: boolean }>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { body }, params: { id, noteId } },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/notes/{noteId}/edit",
      }),
    200,
  );

export const deleteReportNote = async ({
  id,
  noteId,
}: {
  id: number;
  noteId: number;
}) =>
  await settle<{ ok: boolean }>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { params: { id, noteId } },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/notes/{noteId}/delete",
      }),
    200,
  );

export const resolveReport = async ({
  expectedVersion,
  explanation,
  id,
  resolution,
}: {
  expectedVersion: number;
  explanation?: string;
  id: number;
  resolution: "action_taken" | "duplicate" | "no_violation";
}) =>
  await settle<ReportState>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: {
          body: {
            expectedVersion,
            explanation: explanation ?? null,
            resolution,
          },
          params: { id },
        },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/resolve",
      }),
    200,
  );

export const reopenReport = async ({
  expectedVersion,
  id,
  reason,
}: {
  expectedVersion: number;
  id: number;
  reason: string;
}) =>
  await settle<ReportState>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { expectedVersion, reason }, params: { id } },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/reopen",
      }),
    200,
  );

export const runReportAction = async ({
  action,
  expectedVersion,
  id,
}: {
  action: "hide" | "unhide";
  expectedVersion: number;
  id: number;
}) =>
  await settle<ReportState & { changed: boolean }>(
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { expectedVersion }, params: { action, id } },
        method: "post",
        module: "moderation",
        options,
        path: "/reports/{id}/actions/{action}",
      }),
    200,
  );
