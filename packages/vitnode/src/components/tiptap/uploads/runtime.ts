import React from "react";

import type { EditorUploadResult } from "@/lib/editor-uploads";

export type EditorUploadRejection = "too_large" | "type" | "upload";

export interface EditorUploadRuntime {
  attachments: boolean;
  onReject: (
    rejection: EditorUploadRejection,
    file: File,
    detail?: string,
  ) => void;
  remote: boolean;
  upload: (file: File) => Promise<EditorUploadResult>;
}

export const EditorUploadRuntimeContext =
  React.createContext<EditorUploadRuntime | null>(null);

export const useEditorUploadRuntime = (): EditorUploadRuntime | null =>
  React.use(EditorUploadRuntimeContext);
