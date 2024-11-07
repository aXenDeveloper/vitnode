import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormIconPicker } from '@/components/form/fields/icon-picker';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSelect } from '@/components/form/fields/select';
import { AutoFormTagInput } from '@/components/form/fields/tags-input';
import { TextAndIconsAsideAdmin } from '@/views/admin/layout/sidebar/sidebar';
import { Ban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { useCreateNavPluginAdmin } from './hooks/use-create-nav-plugin-admin';

export const CreateEditNavDevPluginAdmin = ({
  data,
  dataFromSSR,
  textsAndIcons,
  parentId,
}: {
  data?: ParentNavAuthAdminObj;
  dataFromSSR: ParentNavAuthAdminObj[];
  parentId?: string;
  textsAndIcons: TextAndIconsAsideAdmin[];
}) => {
  const t = useTranslations('admin.core.plugins.dev.nav');
  const { onSubmit, formSchema } = useCreateNavPluginAdmin({
    data,
    parentId,
    dataFromSSR,
  });

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'parent_code',
          type: DependencyType.HIDES,
          targetField: 'parent_code',
          when: () => !!data,
        },
      ]}
      fields={[
        {
          id: 'code',
          label: t('create.code.label'),
          description: t('create.code.desc'),
          component: AutoFormInput,
        },
        {
          id: 'parent_code',
          label: t('create.parent.label'),
          component: props => (
            <AutoFormSelect
              {...props}
              labels={{
                null: (
                  <div className="flex flex-wrap items-center gap-2">
                    <Ban className="text-muted-foreground size-4" />
                    <span>{t('create.parent.null')}</span>
                  </div>
                ),
                ...Object.fromEntries(
                  dataFromSSR.map(nav => {
                    const textAndIcon = textsAndIcons.find(
                      item => item.id === nav.code,
                    );

                    if (!textAndIcon) return [nav.code, nav.code];

                    return [
                      nav.code,
                      <div
                        className="flex flex-wrap items-center gap-2"
                        key={nav.code}
                      >
                        {textAndIcon.icon}

                        <span>{textAndIcon.text}</span>
                      </div>,
                    ];
                  }),
                ),
              }}
            />
          ),
        },
        {
          id: 'icon',
          label: t('create.icon.label'),
          component: AutoFormIconPicker,
        },
        {
          id: 'keywords',
          label: t('create.keywords.label'),
          description: t('create.keywords.desc'),
          component: props => <AutoFormTagInput {...props} multiple />,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
    />
  );
};
