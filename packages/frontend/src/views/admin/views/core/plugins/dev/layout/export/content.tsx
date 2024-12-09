import { fetcherClient } from '@/api/fetcher-client';
import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormRadioGroup } from '@/components/form/fields/radio-group';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog';
import { increaseVersionString } from '@/helpers/increase-version-string';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ExportPluginsAdminBody } from 'vitnode-shared/admin/plugins.dto';
import { z } from 'zod';

import { useDevPluginAdmin } from '../../hooks/use-dev-plugin';

export const ContentExportActionDevPluginAdmin = () => {
  const t = useTranslations('admin.core.plugins.dev.export');
  const tError = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const { code, version, version_code, name } = useDevPluginAdmin();
  const formSchema = z
    .object({
      type: z.enum(['rebuild', 'new_version']).default('rebuild'),
      version: z.string().default(increaseVersionString(version)).optional(),
      version_code: z.coerce
        .number()
        .min(version_code + 1)
        .default(version_code + 1)
        .optional(),
    })
    .refine(data => {
      if (
        data.type === 'new_version' &&
        (!data.version || !data.version_code)
      ) {
        return false;
      }

      return true;
    });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { res } = await fetcherClient<object, ExportPluginsAdminBody>({
        url: `/admin/plugins/${code}/export`,
        method: 'POST',
        body: values.type === 'rebuild' ? {} : values,
      });

      const contentDisposition = res.headers.get('Content-Disposition');
      if (!contentDisposition) {
        throw new Error('Content-Disposition header not found');
      }

      const fileNameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const fileNameMatch = fileNameRegex.exec(contentDisposition);
      if (!fileNameMatch?.[1]) {
        throw new Error('File name not found');
      }
      const fileName = fileNameMatch[1].replace(/['"]/g, '');

      const file = await res.blob();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      setOpen?.(false);
      toast.success(t('success'), {
        description: name,
      });
    } catch (_) {
      toast.error(tError('title'), {
        description: tError('internal_server_error'),
      });
    }
  };

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'type',
          type: DependencyType.HIDES,
          targetField: 'version',
          when: (provider: string) => provider !== 'new_version',
        },
        {
          sourceField: 'type',
          type: DependencyType.HIDES,
          targetField: 'version_code',
          when: (provider: string) => provider !== 'new_version',
        },
        {
          sourceField: 'type',
          type: DependencyType.REQUIRES,
          targetField: 'version',
          when: (provider: string) => provider === 'new_version',
        },
        {
          sourceField: 'type',
          type: DependencyType.REQUIRES,
          targetField: 'version_code',
          when: (provider: string) => provider === 'new_version',
        },
      ]}
      fields={[
        {
          id: 'type',
          component: props => (
            <AutoFormRadioGroup
              labels={{
                rebuild: {
                  title: t('type.rebuild', {
                    version: `${version} (${version_code})`,
                  }),
                },
                new_version: {
                  title: t('type.new_version'),
                },
              }}
              {...props}
            />
          ),
        },
        {
          id: 'version',
          label: t('version'),
          component: AutoFormInput,
        },
        {
          id: 'version_code',
          label: t('version_code'),
          component: props => <AutoFormInput {...props} type="number" />,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => <Button {...props}>{t('submit')}</Button>}
    />
  );
};
