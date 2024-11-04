'use client';

import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { ShowAdminPlugins } from '@/graphql/types';
import { useTranslations } from 'next-intl';

import { useCreateEditPluginAdmin } from './hooks/use-create-edit-plugin-admin';

export const FormCreateEditPluginAdmin = ({
  data,
  className,
}: {
  className?: string;
  data?: ShowAdminPlugins;
}) => {
  const t = useTranslations('admin.core.plugins');
  const { onSubmit, formSchema } = useCreateEditPluginAdmin({ data });

  return (
    <AutoForm
      className={className}
      dependencies={[
        {
          sourceField: 'code',
          type: DependencyType.HIDES,
          targetField: 'code',
          when: () => !!data,
        },
      ]}
      fields={[
        {
          id: 'name',
          component: AutoFormInput,
          label: t('create.name.label'),
        },
        {
          id: 'description',
          component: AutoFormInput,
          label: t('create.description.label'),
        },
        {
          id: 'code',
          component: props => (
            <AutoFormInput {...props} placeholder="vitnode-plugin-example" />
          ),
          label: t('create.code.label'),
          description: t('create.code.desc'),
        },
        {
          id: 'support_url',
          component: props => <AutoFormInput {...props} type="url" />,
          label: t('create.support_url.label'),
          description: t('create.support_url.desc'),
        },
        {
          id: 'author',
          component: AutoFormInput,
          label: t('create.author.label'),
          description: t('create.author.desc'),
        },
        {
          id: 'author_url',
          component: props => <AutoFormInput {...props} type="url" />,
          label: t('create.author_url.label'),
          description: t('create.author_url.desc'),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
    />
  );
};
