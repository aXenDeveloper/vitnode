import { fetcherClient } from '@/api/fetcher-client';
import { useDialog } from '@/components/ui/dialog';
import { zodFile } from '@/helpers/zod';
import { revalidateAllApi } from '@/views/admin/views/core/diagnostic/actions/clear_cache/hooks/revalidate-all-api';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ReactCropperElement } from 'react-cropper';
import { toast } from 'sonner';
import { UploadAvatarUserSettingsAuthBody } from 'vitnode-shared/auth/settings/user.dto';
import { z } from 'zod';
import { ContentChangeAvatar } from '../content';

export const useChangeAvatar = ({
  user,
}: React.ComponentProps<typeof ContentChangeAvatar>) => {
  const t = useTranslations('core.settings.overview.change_avatar');
  const tErrors = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
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
  const [values, setValues] = React.useState<
    Partial<z.infer<typeof formSchema>>
  >({});

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const formData = new FormData();
    if (values.type === 'upload') {
      const cropper = cropperRef.current?.cropper;
      if (!cropper) return;

      const blob = await fetch(cropper.getCroppedCanvas().toDataURL()).then(
        async res => res.blob(),
      );
      const file = new File([blob], `${user.id}.webp`, {
        type: blob.type,
      });

      formData.append('avatar', file);
    } else {
      formData.append('delete_avatar', 'true');
    }

    try {
      await fetcherClient<object, UploadAvatarUserSettingsAuthBody>({
        method: 'PUT',
        url: '/core/auth/settings/user/avatar',
        body: formData,
      });
      await revalidateAllApi();
      toast.success(t('success'));
      setOpen?.(false);
    } catch (_) {
      toast.error(tErrors('title'), {
        description: tErrors('internal_server_error'),
      });
    }
  };

  return { formSchema, cropperRef, onSubmit, setValues, values };
};
