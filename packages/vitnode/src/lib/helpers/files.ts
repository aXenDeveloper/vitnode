import { z } from "zod";

/**
 * A file the form already holds: uploaded, stored, and referenced by its
 * `core_files` id. `AutoFormFiles` produces these, so a submit handler saves
 * ids and nothing else has to know how the bytes got there.
 */
export const uploadedFileSchema = z.object({
  id: z.number(),
  mimeType: z.string().nullable(),
  name: z.string(),
  size: z.number(),
  url: z.string(),
});

export type UploadedFile = z.infer<typeof uploadedFileSchema>;

/**
 * Schema for an `AutoFormFiles` field.
 *
 * ```ts
 * z.object({ attachments: uploadedFilesSchema({ max: 5 }) })
 * ```
 */
export const uploadedFilesSchema = ({
  max,
  min,
}: {
  max?: number;
  min?: number;
} = {}) => {
  let value = z.array(uploadedFileSchema);
  if (min !== undefined) {
    value = value.min(min);
  }
  if (max !== undefined) {
    value = value.max(max);
  }

  return value.default([]);
};

/** The field value, whatever `react-hook-form` currently holds in it. */
export const toUploadedFiles = (value: unknown): UploadedFile[] => {
  const parsed = z.array(uploadedFileSchema).safeParse(value);

  return parsed.success ? parsed.data : [];
};
