import { useDialog } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as z from 'zod';

import { ContentCreateMethodsAuthSettingsAdmin } from '../content';
import { mutationApi } from './mutation-api';

export const useCreateMethodAuthAdminApi = ({
  enabledMethods,
}: React.ComponentProps<typeof ContentCreateMethodsAuthSettingsAdmin>) => {
  const { setOpen } = useDialog();
  const t = useTranslations('core.global');
  const formSchema = z.object({
    provider: z.enum(
      enabledMethods.map(method => method.code) as [string, ...string[]],
    ),
    client_id: z.string().default(''),
    client_secret: z.string().default(''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await mutationApi({
        code: values.provider,
        client_id: values.client_id,
        client_secret: values.client_secret,
      });

      setOpen?.(false);
      toast.success(t('saved_success'));
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return { formSchema, onSubmit };
};
