import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  StorageApiPlugin,
  StorageUploadArgs,
  StorageUploadResult,
} from "@/api/models/storage";

import { CONFIG } from "@/lib/config";

/**
 * Zero-config storage backend that writes uploads to the local disk.
 *
 * - On the standalone Node API (`@hono/node-server`) files are served by Hono's
 *   `serveStatic`, wired from the `static` descriptor below. The API is mounted
 *   under `/api`, so `publicPath` defaults to `/api/uploads`.
 * - Inside a Next.js app the `public/` directory is served at the site root, so
 *   pass `publicPath: "/uploads"` there (the `static` descriptor is unused).
 *
 * Local disk is not durable on serverless platforms — use a cloud adapter there.
 */
export const LocalStorageAdapter = ({
  baseUrl,
  publicPath = "/api/uploads",
  uploadsDir = "public/uploads",
}: {
  baseUrl?: string;
  publicPath?: string;
  uploadsDir?: string;
} = {}): StorageApiPlugin => {
  const resolvePath = (key: string): string =>
    join(process.cwd(), uploadsDir, key);
  const getUrl = (key: string): string =>
    `${baseUrl ?? CONFIG.api.origin}${publicPath}/${key}`;
  // Route registered on the API app, which already carries the `/api` basePath.
  const mountPath = `${publicPath.replace(/^\/api/, "")}/*`;

  return {
    delete: async (key: string): Promise<void> => {
      await rm(resolvePath(key), { force: true });
    },
    getUrl,
    static: {
      mountPath,
      root: `./${uploadsDir}`,
      stripPrefix: publicPath,
    },
    upload: async ({
      body,
      key,
    }: StorageUploadArgs): Promise<StorageUploadResult> => {
      const filePath = resolvePath(key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, body);

      return { key, url: getUrl(key) };
    },
  };
};
