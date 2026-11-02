import type {
  StorageApiPlugin,
  StorageUploadArgs,
  StorageUploadResult,
} from "@vitnode/core/api/models/storage";

import { StorageClient } from "@supabase/storage-js";

// Streams the object and gives up as soon as it passes `maxBytes`, so an
// oversized file is never buffered whole just to be thrown away.
const readCapped = async (
  stream: ReadableStream<unknown>,
  maxBytes: number,
): Promise<null | Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (
        !(value instanceof Uint8Array) ||
        total + value.byteLength > maxBytes
      ) {
        await reader.cancel();

        return null;
      }
      total += value.byteLength;
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

// Uses a Supabase secret key (`sb_secret_…`), the modern replacement for the
// legacy `service_role` key. A still-valid legacy key works too - the value is
// sent verbatim as the `apikey`/`Authorization` header.
export const SupabaseStorageAdapter = ({
  bucket = "",
  privateBucket,
  secretKey = "",
  url = "",
}: {
  bucket: string | undefined;
  /**
   * A second, **private** bucket for protected attachments, read with the
   * secret key. Leave it out and attachment downloads cannot be restricted.
   */
  privateBucket?: string;
  secretKey: string | undefined;
  url: string | undefined;
}): StorageApiPlugin => {
  let client: StorageClient | undefined;

  const getClient = (): StorageClient => {
    if (!(url && secretKey && bucket)) {
      throw new Error("Missing Supabase Storage configuration");
    }

    client ??= new StorageClient(`${url.replace(/\/$/, "")}/storage/v1`, {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    });

    return client;
  };

  const getUrl = (key: string): string =>
    getClient().from(bucket).getPublicUrl(key).data.publicUrl;

  return {
    ...(privateBucket
      ? {
          private: {
            delete: async (key: string): Promise<void> => {
              const { error } = await getClient()
                .from(privateBucket)
                .remove([key]);
              if (error) throw error;
            },
            read: async (key: string) => {
              const { data, error } = await getClient()
                .from(privateBucket)
                .download(key)
                .asStream();
              if (error) return null;

              return { body: data as ReadableStream<Uint8Array> };
            },
            upload: async ({ body, contentType, key }: StorageUploadArgs) => {
              const { error } = await getClient()
                .from(privateBucket)
                .upload(key, body, { contentType, upsert: true });
              if (error) throw error;

              return { key };
            },
          },
        }
      : {}),
    read: async (key: string, { maxBytes }: { maxBytes: number }) => {
      const { data, error } = await getClient()
        .from(bucket)
        .download(key)
        .asStream();
      if (error) return null;

      return await readCapped(data, maxBytes);
    },
    delete: async (key: string): Promise<void> => {
      const { error } = await getClient().from(bucket).remove([key]);
      if (error) throw error;
    },
    getUrl,
    upload: async ({
      body,
      contentType,
      key,
    }: StorageUploadArgs): Promise<StorageUploadResult> => {
      const { error } = await getClient()
        .from(bucket)
        .upload(key, body, { contentType, upsert: true });
      if (error) throw error;

      return { key, url: getUrl(key) };
    },
  };
};
