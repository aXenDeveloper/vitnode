'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormStringLanguageInput } from '@/components/form/fields/text-language-input';
import { useTranslations } from 'next-intl';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { useSettingsCoreAdmin } from './hooks/use-settings-core-admin';

export const ContentMainSettingsCoreAdmin = (props: ShowMiddlewareObj) => {
  const t = useTranslations('admin.core.settings.main');
  const { onSubmit, formSchema } = useSettingsCoreAdmin(props);

  return (
    <AutoForm
      fields={[
        {
          id: 'site_name',
          component: AutoFormInput,
          label: t('name.label'),
        },
        {
          id: 'site_short_name',
          component: AutoFormInput,
          label: t('short_name.label'),
        },
        {
          id: 'site_description',
          component: AutoFormStringLanguageInput,
          label: t('description.label'),
        },
        {
          id: 'contact_email',
          component: props => (
            <AutoFormInput
              {...props}
              placeholder={'contact@your-website.com'}
              type="email"
            />
          ),
          label: t('contact_email.label'),
          description: t('contact_email.desc'),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      theme="horizontal"
    />
  );
};
