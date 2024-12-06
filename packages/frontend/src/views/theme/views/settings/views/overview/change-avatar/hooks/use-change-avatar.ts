import { zodFile } from '@/helpers/zod';
import React from 'react';
import { ReactCropperElement } from 'react-cropper';
import { z } from 'zod';

export const useChangeAvatar = () => {
  const cropperRef = React.useRef<ReactCropperElement>(null);
  const formSchema = z
    .object({
      type: z.enum(['upload', 'delete']).default('upload'),
      file: zodFile.optional(),
    })
    .refine(data => {
      if (data.type === 'upload' && !data.file) {
        return false;
      }

      return true;
    });

  return { formSchema, cropperRef };
};
