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

const discardBody = (body: unknown): void => {
  if (typeof body !== "object" || body === null) return;
  if ("destroy" in body && typeof body.destroy === "function") {
    (body as { destroy: () => void }).destroy();
  } else if ("cancel" in body && typeof body.cancel === "function") {
    void (body as ReadableStream).cancel().catch(() => undefined);
  }
};

export const S3StorageAdapter = ({
  accessKeyId = "",
  bucket = "",
  endpoint,
  forcePathStyle,
  privateBucket,
  publicUrl,
  region = "auto",
  secretAccessKey = "",
}: {
  accessKeyId: string | undefined;
  bucket: string | undefined;
  endpoint?: string;
  forcePathStyle?: boolean;
  /**
   * A second bucket for protected attachments, read only with these
   * credentials. It must not be public - no public bucket policy, no public
   * R2 domain, no CDN in front of it. Leave it out and attachment downloads
   * cannot be restricted.
   */
  privateBucket?: string;
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
      // Without these a stalled bucket holds a request (and its socket) open
      // indefinitely. `requestTimeout` is socket inactivity, not total time,
      // so large uploads that keep moving are unaffected.
      requestHandler: { connectionTimeout: 5000, requestTimeout: 30_000 },
    });

    return client;
  };

  const getUrl = (key: string): string => {
    if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
    if (endpoint) return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;

    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  };

  return {
    ...(privateBucket
      ? {
          private: {
            delete: async (key: string): Promise<void> => {
              await getClient().send(
                new DeleteObjectCommand({ Bucket: privateBucket, Key: key }),
              );
            },
            read: async (key: string) => {
              try {
                const object = await getClient().send(
                  new GetObjectCommand({ Bucket: privateBucket, Key: key }),
                );
                if (!object.Body) return null;

                return {
                  body: object.Body.transformToWebStream() as ReadableStream<Uint8Array>,
                  ...(object.ContentLength === undefined
                    ? {}
                    : { size: object.ContentLength }),
                };
              } catch {
                return null;
              }
            },
            upload: async ({ body, contentType, key }: StorageUploadArgs) => {
              await getClient().send(
                new PutObjectCommand({
                  Body: body,
                  Bucket: privateBucket,
                  ContentType: contentType,
                  Key: key,
                }),
              );

              return { key };
            },
          },
        }
      : {}),
    delete: async (key: string): Promise<void> => {
      await getClient().send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    },
    getUrl,
    read: async (key: string, { maxBytes }: { maxBytes: number }) => {
      try {
        const object = await getClient().send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (!object.Body) return null;
        if ((object.ContentLength ?? 0) > maxBytes) {
          // Not reading the body would leave the socket busy until the whole
          // object drains (or never), starving the client's connection pool.
          discardBody(object.Body);

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
