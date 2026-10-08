import type {
  ContentDraftRejection,
  ContentDrafts,
  ContentFieldLockAction,
} from "@/content/live/http";
import type { ContentFieldLock } from "@/content/live/protocol";

import {
  zodContentDraftRejection,
  zodContentDrafts,
  zodContentDraftWritten,
  zodContentFieldLocked,
  zodContentFieldLockList,
  zodContentFieldLockResponse,
} from "@/content/live/http";

import type { ContentApiTarget } from "../content-request";

import { sendContentApiRequest as send } from "../lib/api-result";

export type { ContentFieldLockAction };

export interface ContentFieldLockResult {
  error?: string;
  /** The caller's lock after the change; `null` once released. */
  lock?: ContentFieldLock | null;
  /** Someone else holds it (`409`): who, when the API said. */
  lockedBy?: ContentFieldLock | null;
  status: number;
}

export interface ContentDraftSaveResult {
  error?: string;
  /** Which fields were refused and why, for a `400` or a `409`. */
  rejection?: ContentDraftRejection;
  status: number;
  updatedAt?: string;
}

const parseJson = (text: string | undefined): unknown => {
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const listContentLocksInBrowser = async (
  target: ContentApiTarget,
  id: number,
): Promise<{ error?: string; locks: ContentFieldLock[] }> => {
  const result = await send(
    { method: "get", path: `/${id}/locks`, target },
    zodContentFieldLockList,
  );

  return result.data
    ? { locks: result.data.locks }
    : { error: result.error ?? "", locks: [] };
};

export const changeContentLockInBrowser = async (
  target: ContentApiTarget,
  id: number,
  body: {
    action: ContentFieldLockAction;
    field: string;
    locale: null | string;
  },
): Promise<ContentFieldLockResult> => {
  const result = await send(
    { body, method: "post", path: `/${id}/locks`, target },
    zodContentFieldLockResponse,
  );

  if (result.data) return { lock: result.data.lock, status: result.status };

  const locked = zodContentFieldLocked.safeParse(parseJson(result.error));

  return {
    error: result.error ?? "",
    ...(locked.success ? { lockedBy: locked.data.lock } : {}),
    status: result.status,
  };
};

export const readContentDraftInBrowser = async (
  target: ContentApiTarget,
  id: number,
): Promise<{ drafts?: ContentDrafts; error?: string }> => {
  const result = await send(
    { method: "get", path: `/${id}/draft`, target },
    zodContentDrafts,
  );

  return result.data ? { drafts: result.data } : { error: result.error ?? "" };
};

export const saveContentDraftInBrowser = async (
  target: ContentApiTarget,
  id: number,
  body: { locale: null | string; values: Record<string, unknown> },
): Promise<ContentDraftSaveResult> => {
  const result = await send(
    { body, method: "put", path: `/${id}/draft`, target },
    zodContentDraftWritten,
  );

  if (result.data) {
    return { status: result.status, updatedAt: result.data.updatedAt };
  }

  const rejection = zodContentDraftRejection.safeParse(parseJson(result.error));

  return {
    error: result.error ?? "",
    ...(rejection.success ? { rejection: rejection.data } : {}),
    status: result.status,
  };
};
