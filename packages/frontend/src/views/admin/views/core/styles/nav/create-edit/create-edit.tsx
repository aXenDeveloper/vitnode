import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { AutoFormStringLanguageInput } from '@/components/form/fields/text-language-input';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

import { useCreateEditNavAdmin } from './hooks/use-create-edit-nav-admin';

export const ContentCreateEditNavAdmin = ({
  data,
}: {
  data?: Omit<ShowNavStyles, 'children'>;
}) => {
  const t = useTranslations('admin.core.styles.nav');
  const tCore = useTranslations('core.global');
  const { onSubmit, formSchema } = useCreateEditNavAdmin({ data });

  return (
    <AutoForm
      fields={[
        {
          id: 'name',
          component: AutoFormStringLanguageInput,
          label: t('create.name.label'),
        },
        {
          id: 'description',
          component: AutoFormStringLanguageInput,
          label: t('create.description.label'),
        },
        {
          id: 'href',
          component: AutoFormInput,
          label: t('create.href.label'),
          description: t('create.href.desc'),
        },
        {
          id: 'external',
          component: AutoFormSwitch,
          label: t('create.external.label'),
          description: t('create.external.desc'),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => (
        <Button {...props}>{tCore(data ? 'edit' : 'create')}</Button>
      )}
    />
  );
};
