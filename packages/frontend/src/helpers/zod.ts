import * as z from 'zod';

export const zodLanguageInput = z.array(
  z.object({
    language_code: z.string(),
    value: z.string().trim(),
  }),
);

export const zodComboBoxWithFetcher = z.array(
  z.object({
    key: z.string(),
    value: z.union([z.string(), zodLanguageInput]),
  }),
);

export const zodFiles = z.array(
  z.union([
    z.instanceof(File),
    z.object({
      mimetype: z.string(),
      file_name: z.string(),
      file_name_original: z.string(),
      dir_folder: z.string(),
      extension: z.string(),
      file_size: z.number(),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
    }),
  ]),
);

export const zodTag = z.array(
  z.object({
    id: z.number(),
    value: z.string(),
  }),
);
