import type {
  StorageApiPlugin,
  StorageUploadArgs,
  StorageUploadResult,
} from "@vitnode/core/api/models/storage";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const S3StorageAdapter = ({
  accessKeyId = "",
  bucket = "",
  endpoint,
  forcePathStyle,
  publicUrl,
  region = "auto",
  secretAccessKey = "",
}: {
  accessKeyId: string | undefined;
  bucket: string | undefined;
  endpoint?: string;
  forcePathStyle?: boolean;
  publicUrl?: string;
  region?: string;
  secretAccessKey: string | undefined;
}): StorageApiPlugin => {
  let client: S3Client | undefined;

  // A single client serves AWS S3 and Cloudflare R2 - R2 only needs a custom
  // `endpoint` (and path-style addressing). Created lazily so a missing config
  // fails on first use with a clear error, like the other adapters.
  const getClient = (): S3Client => {
    if (!(bucket && accessKeyId && secretAccessKey)) {
      throw new Error("Missing S3 configuration");
    }

    client ??= new S3Client({
      region,
      endpoint,
      forcePathStyle: forcePathStyle ?? !!endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    return client;
  };

  const getUrl = (key: string): string => {
    if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
    if (endpoint) return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;

    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  };

  return {
    delete: async (key: string): Promise<void> => {
      await getClient().send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    },
    getUrl,
    // Reads with the adapter's own credentials, so a private bucket works
    // without making any object public.
    read: async (key: string, { maxBytes }: { maxBytes: number }) => {
      try {
        const object = await getClient().send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        if ((object.ContentLength ?? 0) > maxBytes || !object.Body) {
          return null;
        }
        const bytes = await object.Body.transformToByteArray();

        return bytes.byteLength > maxBytes ? null : bytes;
      } catch {
        return null;
      }
    },
    upload: async ({
      body,
      contentType,
      key,
    }: StorageUploadArgs): Promise<StorageUploadResult> => {
      await getClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );

      return { key, url: getUrl(key) };
    },
  };
};
