import type { Context } from "hono";

/**
 * Whether the configured storage adapter can keep files private. Without it a
 * file is reachable by anyone holding its URL, so attachment downloads cannot
 * be restricted. Server-only.
 */
export const contentAccessAttachmentSupport = (
  c: Context,
): { privateStorage: boolean } => {
  const storage = c.get("storage") as
    | undefined
    | { supportsPrivateFiles?: () => boolean };

  return { privateStorage: storage?.supportsPrivateFiles?.() === true };
};
