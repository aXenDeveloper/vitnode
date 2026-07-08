import type {
  StorageApiPlugin,
  StorageUploadArgs,
  StorageUploadResult,
} from "@vitnode/core/api/models/storage";

import { StorageClient } from "@supabase/storage-js";

// Uses a Supabase secret key (`sb_secret_…`), the modern replacement for the
// legacy `service_role` key. A still-valid legacy key works too — the value is
// sent verbatim as the `apikey`/`Authorization` header.
export const SupabaseStorageAdapter = ({
  bucket = "",
  secretKey = "",
  url = "",
}: {
  bucket: string | undefined;
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
