import type { EditorUploadResult } from "@/lib/editor-uploads";

import { fetcherClient } from "@/lib/fetcher-client";
import { readApiErrorMessage } from "@/lib/read-api-error";
import { manifest } from "@/manifest";

const requestUpload = async (
  session: "admin" | "member",
  formData: FormData,
): Promise<Response> =>
  session === "admin"
    ? await fetcherClient({
        plugin: manifest.id,
        formData,
        method: "post",
        module: "admin/files",
        options: { credentials: "include" },
        path: "/editor",
      })
    : await fetcherClient({
        plugin: manifest.id,
        formData,
        method: "post",
        module: "users/files",
        options: { credentials: "include" },
        path: "/editor",
      });

export const uploadEditorFile = async (
  session: "admin" | "member",
  file: File,
): Promise<EditorUploadResult> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await requestUpload(session, formData);
  if (!response.ok) {
    throw new Error(
      (await readApiErrorMessage(response)) ??
        `The upload answered ${response.status}.`,
    );
  }

  return await response.json();
};
