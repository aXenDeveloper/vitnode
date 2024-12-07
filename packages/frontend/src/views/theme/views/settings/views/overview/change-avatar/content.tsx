import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormFileInput } from '@/components/form/fields/file-input';
import { AutoFormRadioGroup } from '@/components/form/fields/radio-group';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { useTranslations } from 'next-intl';

import { CopperChangeAvatar } from './cropper/cropper';
import { useChangeAvatar } from './hooks/use-change-avatar';

export const ContentChangeAvatar = () => {
  const { formSchema, cropperRef, onSubmit, setValues, values } =
    useChangeAvatar();
  const { user } = useSession();
  const t = useTranslations('core.settings.overview.change_avatar');

  if (!user) return null;

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'type',
          type: DependencyType.HIDES,
          targetField: 'file',
          when: (type: string) => type !== 'upload',
        },
        {
          sourceField: 'type',
          type: DependencyType.HIDES,
          targetField: 'type',
          when: () => !user.avatar,
        },
        {
          sourceField: 'file',
          type: DependencyType.HIDES,
          targetField: 'file',
          when: (file: string) => !!file,
        },
      ]}
      fields={[
        {
          id: 'type',
          component: props => (
            <AutoFormRadioGroup
              {...props}
              labels={{
                upload: {
                  title: t('types.upload'),
                },
                delete: {
                  title: t('types.delete'),
                },
              }}
            />
          ),
        },
        {
          id: 'file',
          component: props => (
            <AutoFormFileInput
              {...props}
              accept="image/png, image/jpeg, image/webp"
              acceptExtensions={['png', 'jpg', 'webp']}
              maxFileSizeInMb={2}
              showInfo
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      onValuesChange={setValues}
      submitButton={props => <Button {...props}>{t('submit')}</Button>}
    >
      {values.file && values.file instanceof File && (
        <CopperChangeAvatar cropperRef={cropperRef} file={values.file} />
      )}
    </AutoForm>
  );
};
