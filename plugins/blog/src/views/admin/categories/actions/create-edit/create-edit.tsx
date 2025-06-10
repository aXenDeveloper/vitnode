import { AutoForm } from '@vitnode/core/components/form/auto-form';
import { AutoFormInput } from '@vitnode/core/components/form/fields/input';
import { useDialog } from '@vitnode/core/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';

import type { zodCreateCategorySchema } from '@/api/modules/categories/routes/create.route';

import { mutationApi } from './mutation-api';

export const CreateEditActionCategoriesAdmin = ({
  data,
}: {
  data?: z.infer<typeof zodCreateCategorySchema> & { id: string };
}) => {
  const t = useTranslations('@vitnode/blog.admin.categories.create');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const formSchema = z.object({
    title: z
      .string()
      .min(3, {
        message: tCore('field_min_length', {
          min: 3,
        }),
      })
      .default(data?.title ?? ''),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const mutation = await mutationApi(values);
    if (mutation?.message) {
      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });

      return;
    }
    setOpen?.(false);
  };

  return (
    <AutoForm
      fields={[
        {
          id: 'title',
          component: props => (
            <AutoFormInput
              label={t('form.title.label')}
              placeholder={t('form.title.placeholder')}
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t('submit'),
      }}
    />
  );
};
