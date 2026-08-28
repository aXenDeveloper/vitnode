/**
 * Why {@link StorageModel.deleteFile} refused.
 *
 * Declared here rather than in `@/api/models/storage`, which is where it used to
 * live and which still re-exports it, because {@link readFileInUse} runs in a
 * browser. Importing the constant from the storage model pulled Hono, Drizzle
 * and the whole `@/database` tree into the client bundle of every surface that
 * deletes a file - a value import is a value import, however small the value.
 * This module now has no runtime imports at all, which is the property that
 * makes it safe from either framework.
 */
export const STORAGE_FILE_IN_USE = "FILE_IN_USE";

/**
 * The body of that refusal, and the reason it is not just a code.
 *
 * "In use" covers two situations a person has to act on differently: content
 * that would break, and history that would merely lose a restore. `content` is
 * the one that is final; `revisions` is how many retained revisions hold the
 * file, so a client can offer to force past them and say how much it is giving
 * up.
 */
export interface StorageFileInUseBody {
  code: typeof STORAGE_FILE_IN_USE;
  /** A live content column or gallery row still points at this file. */
  content: boolean;
  id: number;
  /** Retained revisions pinning it - releasable with `force`. */
  revisions: number;
}

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

/**
 * What every file-delete path returns - the Next.js server actions and the
 * browser mutation the TanStack Start app calls.
 *
 * A closed result rather than a thrown error, because all three refusals are
 * ordinary answers a person acts on: `409` is offered as a confirmation, `404`
 * is "already gone", and anything else is "try again". Only a transport failure
 * rejects.
 */
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
