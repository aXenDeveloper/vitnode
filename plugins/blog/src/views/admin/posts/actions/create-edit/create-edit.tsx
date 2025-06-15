import { AutoForm } from '@vitnode/core/components/form/auto-form';
import { AutoFormComboboxAsync } from '@vitnode/core/components/form/fields/combobox-async';
import { AutoFormInput } from '@vitnode/core/components/form/fields/input';
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea';
import { fetcherClient } from '@vitnode/core/lib/fetcher-client';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import type { zodCreatePostSchema } from '@/api/modules/posts/routes/create.route';

import { categoriesModule } from '../../../../../api/modules/categories/categories.module';

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
    categoryId: z.object({ value: z.string(), label: z.string() }),
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
          id: 'categoryId',
          component: props => (
            <AutoFormComboboxAsync
              fetchData={async ({ search }) => {
                const res = await fetcherClient(categoriesModule, {
                  path: '/',
                  method: 'get',
                  module: 'categories',
                  args: {
                    query: {
                      search,
                    },
                  },
                });
                const data = await res.json();

                return data.edges.map(category => ({
                  label: category.title,
                  value: category.id.toString(),
                }));
              }}
              id="categoryId"
              label={t('create.form.category')}
              {...props}
            />
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
