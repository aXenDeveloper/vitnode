'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormTextArea } from '@/components/form/fields/textarea';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShowDashboardAdminObj } from 'vitnode-shared/admin/dashboard.dto';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const NoteForm = ({ data }: { data: ShowDashboardAdminObj['note'] }) => {
  const t = useTranslations('core.global');
  const formSchema = z.object({
    text: z.string().default(data.text),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await mutationApi({ text: values.text });
      toast.success(t('saved_success'));
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return (
    <AutoForm
      fields={[
        {
          id: 'text',
          component: props => <AutoFormTextArea className="h-44" {...props} />,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
    />
  );
};
