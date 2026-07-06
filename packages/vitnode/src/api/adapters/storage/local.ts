import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  StorageApiPlugin,
  StorageUploadArgs,
  StorageUploadResult,
} from "@/api/models/storage";

import { CONFIG } from "@/lib/config";

/**
 * Zero-config storage backend that writes uploads to the local disk under
 * `public/uploads`.
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
}: {
  baseUrl?: string;
  publicPath?: string;
} = {}): StorageApiPlugin => {
  // Static path segments (not a variable) so Next's file tracer can scope the
  // trace to `public/uploads` instead of the whole project.
  const resolvePath = (key: string): string =>
    join(process.cwd(), "public", "uploads", key);
  const getUrl = (key: string): string => {
    const base = (baseUrl ?? CONFIG.api.origin).replace(/\/$/, "");
    const path = publicPath.replace(/^\/|\/$/g, "");

    return `${base}/${path}/${key}`;
  };
  // Route registered on the API app, which already carries the `/api` basePath.
  const mountPath = `${publicPath.replace(/^\/api/, "")}/*`;

  return {
    delete: async (key: string): Promise<void> => {
      await rm(resolvePath(key), { force: true });
    },
    getUrl,
    static: {
      mountPath,
      root: "./public/uploads",
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
