"use client";

import type { UploadFieldLimits } from "@vitnode/core/components/form/fields/files";
import type { UploadedFile } from "@vitnode/core/lib/helpers/files";

import { AutoForm } from "@vitnode/core/components/form/auto-form";
import { AutoFormFiles } from "@vitnode/core/components/form/fields/files";
import { uploadedFilesSchema } from "@vitnode/core/lib/helpers/files";
import { z } from "zod";

const formSchema = z.object({
  attachments: uploadedFilesSchema({ max: 3 }),
});

// The real field asks the API what the signed-in user may upload; this preview
// hands it fixed limits instead so the docs work without a session.
const limits: UploadFieldLimits = {
  allowUpload: true,
  allowedMimeTypes: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
  ],
  maxBytesPerSubmit: 5 * 1024 * 1024,
  maxFiles: 3,
  maxTotalBytes: 20 * 1024 * 1024,
  remainingBytes: 16 * 1024 * 1024,
  usedBytes: 4 * 1024 * 1024,
};

let previewId = 0;

const upload = async (files: File[]): Promise<UploadedFile[]> =>
  Promise.resolve(
    files.map(file => ({
      id: ++previewId,
      mimeType: file.type,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    })),
  );

export default function FilesExample() {
  return (
    <AutoForm
      fields={[
        {
          id: "attachments",
          component: props => (
            <AutoFormFiles
              {...props}
              description="Up to 3 files. Nothing leaves your browser in this preview."
              label="Attachments"
              limits={limits}
              remove={async () => Promise.resolve()}
              upload={upload}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  );
}
