import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormEditor } from '@/components/form/fields/editor';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { AutoFormStringLanguageInput } from '@/components/form/fields/text-language-input';
import { Button } from '@/components/ui/button';
import { removeSpecialCharacters } from '@/helpers/special-characters';
import { useTranslations } from 'next-intl';
import { LegalsObj } from 'vitnode-shared/legal.dto';

import { useCreateEditLegalAdmin } from './hooks/use-create-edit-legal-admin';

export const ContentCreateEditLegalPage = ({
  data,
}: {
  data?: LegalsObj['edges'][0];
}) => {
  const t = useTranslations('admin.core.settings.legal.create_edit');
  const { onSubmit, formSchema } = useCreateEditLegalAdmin({ data });

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'external_href',
          type: DependencyType.HIDES,
          targetField: 'href',
          when: (state: boolean) => !state,
        },
        {
          sourceField: 'external_href',
          type: DependencyType.REQUIRES,
          targetField: 'href',
          when: (state: boolean) => state,
        },
        {
          sourceField: 'external_href',
          type: DependencyType.HIDES,
          targetField: 'content',
          when: (state: boolean) => state,
        },
        {
          sourceField: 'external_href',
          type: DependencyType.REQUIRES,
          targetField: 'content',
          when: (state: boolean) => !state,
        },
      ]}
      fields={[
        {
          id: 'title',
          label: t('form.title'),
          component: AutoFormStringLanguageInput,
        },
        {
          id: 'code',
          label: t('form.code.title'),
          description: t('form.code.desc'),
          component: props => <AutoFormInput {...props} />,
          wrapper: ({ field, children }) => {
            const value: string = field.value ?? '';
            const parsedValue = removeSpecialCharacters(value);

            return (
              <>
                {children}
                <div className="text-muted-foreground mt-1 text-sm">
                  {t.rich('form.code.preview_url', {
                    url: () => (
                      <span className="text-foreground font-semibold">{`/legal/${parsedValue}`}</span>
                    ),
                  })}
                </div>
              </>
            );
          },
        },
        {
          id: 'external_href',
          label: t('form.external_href'),
          component: AutoFormSwitch,
        },
        {
          id: 'href',
          label: t('form.href'),
          component: props => <AutoFormInput {...props} type="url" />,
        },
        {
          id: 'content',
          label: t('form.content'),
          component: props => (
            <AutoFormEditor
              {...props}
              allowUploadFiles={{
                folder: 'legal',
                plugin_code: 'core',
              }}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => (
        <Button {...props}>{t(`submit.${data ? 'edit' : 'create'}`)}</Button>
      )}
    />
  );
};
