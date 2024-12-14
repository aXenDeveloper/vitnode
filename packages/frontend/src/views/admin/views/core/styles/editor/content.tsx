'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { useTranslations } from 'next-intl';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { useEditorAdmin } from './hooks/use-editor-admin';

export const ContentEditorAdmin = (data: ShowMiddlewareObj['editor']) => {
  const t = useTranslations('admin.core.styles.editor');
  const { onSubmit, formSchema } = useEditorAdmin(data);

  return (
    <AutoForm
      fields={[
        {
          id: 'sticky',
          label: t('sticky.label'),
          description: t('sticky.desc'),
          component: AutoFormSwitch,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      theme="horizontal"
    />
  );
};
