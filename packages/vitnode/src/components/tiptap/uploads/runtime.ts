import type { EditorUploadResult } from "@vitnode/api/lib/shared/editor-uploads";

import React from "react";

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
