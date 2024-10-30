import { useDialog } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as z from 'zod';

import { mutationApi } from './mutation-api';

export const useTestingEmailAdmin = () => {
  const t = useTranslations('admin.core.settings.email.test');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const formSchema = z.object({
    to: z.string().min(1).email().default(''),
    subject: z.string().min(1).default(t('test.subject')),
    message: z.string().min(1).default(t('test.message')),
    preview_text: z.string().default(t('test.preview_text')).optional(),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await mutationApi();
      toast.success(t('success.title'), {
        description: t('success.desc'),
      });
      setOpen?.(false);
    } catch (_) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }
  };

  return { onSubmit, formSchema };
};
