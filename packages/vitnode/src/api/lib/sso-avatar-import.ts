import type { Context } from "hono";

import { createHash } from "node:crypto";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import type { RemoteImage } from "./remote-image";

import { downloadRemoteImage, IMAGE_EXTENSIONS } from "./remote-image";
import { setUserImage } from "./user-images";

export interface ImportedAvatarRecord {
  fileId: null | number;
  sha256: null | string;
  sourceUrl: null | string;
}

export interface AvatarImportRequest {
  currentAvatarId: null | number;
  maxBytes: number;
  previous: ImportedAvatarRecord;
  url: string;
  userId: number;
}

export type AvatarImportOutcome =
  | { fileId: number; sha256: string; sourceUrl: string; status: "updated" }
  | { status: "unchanged" };

const stillShowsImport = ({
  currentAvatarId,
  previous,
}: Pick<AvatarImportRequest, "currentAvatarId" | "previous">): boolean =>
  previous.fileId !== null && previous.fileId === currentAvatarId;

export const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export const importProviderAvatar = async (
  c: Context<EnvVitNode>,
  request: AvatarImportRequest,
  {
    download = async (url, maxBytes) =>
      await downloadRemoteImage(url, { maxBytes }),
  }: {
    download?: (url: string, maxBytes: number) => Promise<RemoteImage>;
  } = {},
): Promise<AvatarImportOutcome> => {
  if (stillShowsImport(request) && request.previous.sourceUrl === request.url) {
    return { status: "unchanged" };
  }

  const image = await download(request.url, request.maxBytes);
  const sha256 = sha256Hex(image.bytes);

  if (stillShowsImport(request) && request.previous.sha256 === sha256) {
    return { status: "unchanged" };
  }

  const stored = await setUserImage(c, {
    file: new File(
      [image.bytes],
      `avatar.${IMAGE_EXTENSIONS[image.mimeType]}`,
      { type: image.mimeType },
    ),
    kind: "avatar",
    maxBytes: request.maxBytes,
    userId: request.userId,
  });

  return {
    fileId: stored.id,
    sha256,
    sourceUrl: request.url,
    status: "updated",
  };
};
