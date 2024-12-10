import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormCombobox } from '@/components/form/fields/combobox';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { LanguagesAdminObj } from 'vitnode-shared/admin/language.dto';

import { useCreateEditLangAdmin } from './hooks/use-create-edit-lang-admin';
import { locales } from './locales';

export const CreateEditLangAdmin = ({ data }: { data?: LanguagesAdminObj }) => {
  const t = useTranslations('admin.core.langs.actions');
  const { onSubmit, formSchema } = useCreateEditLangAdmin({ data });

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'default',
          type: DependencyType.HIDES,
          targetField: 'default',
          when: () => !data,
        },
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
          id: 'timezone',
          label: t('create.timezone.label'),
          component: props => (
            <AutoFormCombobox
              {...props}
              labels={Object.fromEntries(
                locales.map(item => [
                  item.locale,
                  `${item.name} - ${item.locale}`,
                ]),
              )}
            />
          ),
        },
        {
          id: 'code',
          component: AutoFormInput,
          label: t('create.code.label'),
        },
        {
          id: 'time_24',
          component: AutoFormSwitch,
          label: t('create.time_24.label'),
          description: t('create.time_24.desc'),
        },
        {
          id: 'allow_in_input',
          component: AutoFormSwitch,
          label: t('create.allow_in_input.label'),
          description: t('create.allow_in_input.desc'),
        },
        {
          id: 'default',
          component: AutoFormSwitch,
          label: t('edit.default.label'),
          description: t('edit.default.desc'),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => (
        <Button {...props}>{t(data ? 'edit.submit' : 'create.submit')}</Button>
      )}
    />
  );
};
