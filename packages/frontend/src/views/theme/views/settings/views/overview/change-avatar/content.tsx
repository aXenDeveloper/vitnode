import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormFileInput } from '@/components/form/fields/file-input';
import { AutoFormRadioGroup } from '@/components/form/fields/radio-group';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

import { CopperChangeAvatar } from './cropper/cropper';
import { useChangeAvatar } from './hooks/use-change-avatar';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

export const ContentChangeAvatar = ({
  user,
}: {
  user: UserWithDangerousInfo;
}) => {
  const { formSchema, cropperRef, onSubmit, setValues, values } =
    useChangeAvatar({ user });
  const t = useTranslations('core.settings.overview.change_avatar');

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
              acceptExtensions={['png', 'jpg', 'jpeg', 'webp']}
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
