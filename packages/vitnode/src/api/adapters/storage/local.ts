import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  StorageApiPlugin,
  StorageUploadArgs,
  StorageUploadResult,
} from "@/api/models/storage";

import { CONFIG } from "@/lib/config";

/**
 * Stores uploads on the API server's disk, under `public/uploads` in the
 * process's working directory. For development and single-server installs; use
 * a cloud adapter when the API runs on more than one machine or on an
 * ephemeral filesystem.
 *
 * Files are served only once the app mounts `serveStatic` from the adapter's
 * `static` descriptor in its server entry. Server-only.
 *
 * @example
 * ```ts
 * import { LocalStorageAdapter } from "@vitnode/core/api/adapters/storage/local";
 *
 * buildApiConfig({ storage: { adapter: LocalStorageAdapter() } });
 * ```
 */
export const LocalStorageAdapter = ({
  baseUrl,
  publicPath = "/api/uploads",
}: {
  /** The origin public URLs start with. Defaults to the origin of `VITNODE_API_URL` (`http://localhost:3000` when unset). */
  baseUrl?: string;
  /** The URL path files are served under. Defaults to `/api/uploads`. */
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
    read: async (key: string, { maxBytes }: { maxBytes: number }) => {
      const filePath = resolvePath(key);
      try {
        const { size } = await stat(filePath);
        if (size > maxBytes) return null;

        return await readFile(filePath);
      } catch {
        return null;
      }
    },
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
