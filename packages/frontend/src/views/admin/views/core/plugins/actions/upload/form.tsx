import { fetcherClient } from '@/api/fetcher-client';
import { AutoForm } from '@/components/form/auto-form';
import { AutoFormFileInput } from '@/components/form/fields/file-input';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog';
import { zodFile } from '@/helpers/zod';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { revalidateApi } from './revalidate-api';

export const FormUploadPluginAdmin = () => {
  const t = useTranslations('admin.core.plugins.upload');
  const { setOpen } = useDialog();
  const tError = useTranslations('core.global.errors');
  const formSchema = z.object({
    file: zodFile,
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    const formData = new FormData();
    if (!values.file || !(values.file instanceof File)) return;
    formData.append('file', values.file);

    try {
      await fetcherClient({
        url: '/admin/plugins/upload',
        method: 'POST',
        body: formData,
      });
      await revalidateApi();

      setOpen?.(false);
      toast.success(t('success.upload'));
    } catch (err) {
      const error = err as Error;

      if (error.message.includes('CONFLICT_PLUGIN_CODE')) {
        form.setError('file', {
          message: t('errors.CONFLICT_PLUGIN_CODE'),
        });

        return;
      }
      if (error.message.includes('PLUGIN_ALREADY_EXISTS')) {
        form.setError('file', {
          message: t('errors.PLUGIN_ALREADY_EXISTS'),
        });

        return;
      }
      if (error.message.includes('PLUGIN_VERSION_IS_LOWER')) {
        form.setError('file', {
          message: t('errors.PLUGIN_VERSION_IS_LOWER'),
        });

        return;
      }

      toast.error(tError('title'), {
        description: tError('internal_server_error'),
      });
    }
  };

  return (
    <AutoForm
      fields={[
        {
          id: 'file',
          component: props => (
            <AutoFormFileInput
              {...props}
              accept="application/gzip, application/x-compressed"
              acceptExtensions={['tgz']}
              maxFileSizeInMb={10}
              showInfo
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => <Button {...props}>{t('submit')}</Button>}
    />
  );
};
