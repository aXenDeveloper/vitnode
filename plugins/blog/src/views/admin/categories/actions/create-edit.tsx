import { AutoForm } from '@vitnode/core/components/form/auto-form';
import { AutoFormInput } from '@vitnode/core/components/form/fields/input';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

export const CreateEditActionCategoriesAdmin = () => {
  const t = useTranslations('@vitnode/blog.admin.categories.create');
  const formSchema = z.object({
    title: z.string().default(''),
  });

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
      submitButtonProps={{
        children: t('submit'),
      }}
    />
  );
};
