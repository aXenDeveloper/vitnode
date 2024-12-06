import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShowAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const useAuthorizationFormAdmin = (data: ShowAuthSettingsAdminObj) => {
  const t = useTranslations('core.global');
  const formSchema = z.object({
    force_login: z.boolean().default(data.force_login).optional(),
    lock_register: z.boolean().default(data.lock_register).optional(),
    require_confirm_email: z
      .boolean()
      .default(data.require_confirm_email)
      .optional(),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await mutationApi({
        force_login: values.force_login ?? false,
        lock_register: values.lock_register ?? false,
        require_confirm_email: values.require_confirm_email ?? false,
      });

      toast.success(t('saved_success'));
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return {
    formSchema,
    onSubmit,
  };
};
