import { AutoForm } from '@vitnode/core/components/form/auto-form';
import { AutoFormInput } from '@vitnode/core/components/form/fields/input';
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import type { zodCreatePostSchema } from '@/api/modules/posts/routes/create.route';

export const CreateEditActionPostsAdmin = ({
  data,
}: {
  data?: z.infer<typeof zodCreatePostSchema> & { id?: number };
}) => {
  const t = useTranslations('@vitnode/blog.admin.posts');
  const tCore = useTranslations('core.global.errors');
  const formSchema = z.object({
    title: z
      .string()
      .min(3, {
        message: tCore('field_min_length', {
          min: 3,
        }),
      })
      .default(data?.title ?? ''),
    content: z.string().min(1, {
      message: tCore('field_required'),
    }),
  });

  return (
    <AutoForm
      fields={[
        {
          id: 'title',
          component: props => (
            <AutoFormInput label={t('create.form.title')} {...props} />
          ),
        },
        {
          id: 'content',
          component: props => (
            <AutoFormTextarea
              label={t('create.form.content')}
              rows={10}
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      submitButtonProps={{
        children: t(`${data ? 'edit' : 'create'}.submit`),
      }}
    />
  );
};
