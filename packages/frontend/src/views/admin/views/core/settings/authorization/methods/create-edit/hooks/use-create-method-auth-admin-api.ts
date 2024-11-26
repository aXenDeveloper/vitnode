import { useDialog } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

import { ContentCreateEditMethodsAuthSettingsAdmin } from '../content';
import { createMutationApi } from './create-mutation-api';
import { editMutationApi } from './edit-mutation-api';

export const useCreateMethodAuthAdminApi = ({
  dataFromSSR: { enabledMethods },
  data,
}: React.ComponentProps<typeof ContentCreateEditMethodsAuthSettingsAdmin>) => {
  const { setOpen } = useDialog();
  const t = useTranslations('admin.core.settings.authorization.methods');
  const tCore = useTranslations('core.global.errors');
  const [values, setValues] = React.useState<
    Partial<z.infer<typeof formSchema>>
  >({});
  const formSchema = z.object({
    provider: z
      .enum(enabledMethods.map(method => method.code) as [string, ...string[]])
      .default(data?.code ?? ''),
    client_id: z.string().default(data?.client_id ?? ''),
    client_secret: z.string().default(data?.client_secret ?? ''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (data) {
        await editMutationApi({
          code: data.code,
          client_id: values.client_id,
          client_secret: values.client_secret,
          enabled: data.enabled,
        });
      } else {
        await createMutationApi({
          code: values.provider,
          client_id: values.client_id,
          client_secret: values.client_secret,
        });
      }

      setOpen?.(false);
      toast.success(t(`${data ? 'edit' : 'create'}.success`));
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { formSchema, onSubmit, values, setValues };
};
