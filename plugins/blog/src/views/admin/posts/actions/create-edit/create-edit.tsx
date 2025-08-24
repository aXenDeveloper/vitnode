import {
  AutoForm,
  type AutoFormOnSubmit,
} from '@vitnode/core/components/form/auto-form';
import { AutoFormComboboxAsync } from '@vitnode/core/components/form/fields/combobox-async';
import { AutoFormInput } from '@vitnode/core/components/form/fields/input';
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea';
import { useDialog } from '@vitnode/core/components/ui/dialog';
import { fetcherClient } from '@vitnode/core/lib/fetcher-client';
import { usePathname, useRouter } from '@vitnode/core/lib/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { categoriesModule } from '@/api/modules/categories/categories.module';
import type { zodPostSchema } from '@/api/modules/posts/routes/get.route';

import { createMutationApi, editMutationApi } from './mutation-api';

export const CreateEditActionPostsAdmin = ({
  data,
}: {
  data?: z.infer<typeof zodPostSchema> & { id?: number };
}) => {
  const t = useTranslations('@vitnode/blog.admin.posts');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const { push } = useRouter();
  const pathname = usePathname();
  const formSchema = z.object({
    title: z
      .string()
      .min(3, {
        message: tCore('field_min_length', {
          min: 3,
        }),
      })
      .default(data?.title ?? ''),
    content: z.string().default(data?.content ?? ''),
    categoryId: z
      .object({ value: z.string(), label: z.string() })
      .refine(value => value.value !== '', {
        message: tCore('field_required'),
      })
      .default(
        data?.category
          ? { value: data.category.id.toString(), label: data.category.title }
          : { value: '', label: '' },
      ),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    let error = '';
    if (data?.id) {
      const mutation = await editMutationApi({
        id: data.id,
        ...values,
        categoryId: parseInt(values.categoryId.value, 10),
      });

      if (mutation?.error) {
        error = mutation.error;
      }
    } else {
      const mutation = await createMutationApi({
        ...values,
        categoryId: parseInt(values.categoryId.value, 10),
      });

      if (mutation?.error) {
        error = mutation.error;
      }
    }

    if (error) {
      if (error.includes('already exists')) {
        form.setError('title', {
          type: 'manual',
          message: t('create.form.title.already_exists'),
        });

        return;
      }

      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });

      return;
    }
    setOpen?.(false);
    push(pathname);
  };

  return (
    <AutoForm
      fields={[
        {
          id: 'title',
          component: props => (
            <AutoFormInput label={t('create.form.title.label')} {...props} />
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
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t(`${data ? 'edit' : 'create'}.submit`),
      }}
    />
  );
};
