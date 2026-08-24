import type { StorageFileInUseBody } from "@/api/models/storage";

import { STORAGE_FILE_IN_USE } from "@/api/models/storage";

/**
 * What a refused file delete was blocked by, as the two surfaces need it.
 *
 * `content` is final - a live column or gallery row points at the file, and no
 * amount of confirming makes deleting it anything other than a broken page.
 * `revisions` is not: those are retained revisions pinning the file, and asking
 * again with `force` releases them.
 */
export interface FileInUse {
  content: boolean;
  revisions: number;
}

/** What both file-delete server actions return. */
export interface DeleteFileResult {
  data?: true;
  error?: {
    /** Present only for the 409 the storage model answers with. */
    inUse?: FileInUse;
    status: number;
  };
}

/**
 * Reads the `FILE_IN_USE` body off a refused delete, or `undefined`.
 *
 * Defensive about every field rather than trusting the route's own schema: this
 * runs on a response body, and a proxy that turned a 409 into an HTML error page
 * must produce "something went wrong" rather than an exception inside a server
 * action. A body that is not this shape is simply not a reason.
 */
export const readFileInUse = async (
  res: Response,
): Promise<FileInUse | undefined> => {
  if (res.status !== 409) return undefined;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return undefined;
  }

  if (typeof body !== "object" || body === null) return undefined;
  const { code, content, revisions } = body as Partial<StorageFileInUseBody>;
  if (code !== STORAGE_FILE_IN_USE) return undefined;

  return {
    content: content === true,
    revisions: typeof revisions === "number" ? revisions : 0,
  };
};
