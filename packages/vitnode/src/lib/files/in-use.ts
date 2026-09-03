export const STORAGE_FILE_IN_USE = "FILE_IN_USE";

export interface StorageFileInUseBody {
  code: typeof STORAGE_FILE_IN_USE;
  /** A live content column or gallery row still points at this file. */
  content: boolean;
  id: number;
  /** Retained revisions pinning it - releasable with `force`. */
  revisions: number;
}

export interface FileInUse {
  content: boolean;
  revisions: number;
}

export interface DeleteFileResult {
  data?: true;
  error?: {
    /** Present only for the 409 the storage model answers with. */
    inUse?: FileInUse;
    status: number;
  };
}

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
