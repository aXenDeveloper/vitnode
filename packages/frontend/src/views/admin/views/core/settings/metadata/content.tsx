'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormColorPicker } from '@/components/form/fields/color-picker';
import { AutoFormLabel } from '@/components/form/fields/common/label';
import { AutoFormFileInput } from '@/components/form/fields/file-input';
import { AutoFormRadioGroup } from '@/components/form/fields/radio-group';
import { Input } from '@/components/ui/input';
import { CONFIG } from '@/helpers/config-with-env';
import { useTranslations } from 'next-intl';
import { ShowMetadataAdminObj } from 'vitnode-shared/admin/settings/metadata.dto';

import { useMetadataSettingsAdminApi } from './hooks/use-metadata-settings-admin-api';

export const ContentMetadataSettingsAdmin = (data: ShowMetadataAdminObj) => {
  const { formSchema, onSubmit } = useMetadataSettingsAdminApi(data);
  const t = useTranslations('admin.core.settings.metadata');

  return (
    <AutoForm
      fields={[
        {
          id: 'display',
          label: t('display.label'),
          description: t('display.desc'),
          component: props => (
            <AutoFormRadioGroup
              {...props}
              labels={{
                fullscreen: {
                  title: t('display.fullscreen.title'),
                  description: t('display.fullscreen.desc'),
                },
                standalone: {
                  title: t('display.standalone.title'),
                  description: t('display.standalone.desc'),
                },
                minimal: {
                  title: t('display.minimal.title'),
                  description: t('display.minimal.desc'),
                },
                browser: {
                  title: t('display.browser.title'),
                  description: t('display.browser.desc'),
                },
              }}
            />
          ),
        },
        {
          id: 'start_url',
          label: t('start_url.label'),
          description: t('start_url.desc'),
          component: ({
            field,
            description,
            hideOptionalLabel,
            isRequired,
            label,
            theme,
          }) => (
            <>
              <AutoFormLabel
                description={description}
                hideOptionalLabel={hideOptionalLabel}
                isRequired={isRequired}
                label={label}
                theme={theme}
              />
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="text-muted-foreground text-sm">
                  {CONFIG.frontend_url}/
                </div>
                <Input
                  className="order-2 max-w-[14rem]"
                  onBlur={field.onBlur}
                  onChange={e => {
                    field.onChange(e);
                  }}
                  value={field.value}
                />
              </div>
            </>
          ),
        },
        {
          id: 'theme_color',
          label: t('theme_color'),
          component: AutoFormColorPicker,
        },
        {
          id: 'background_color',
          label: t('background_color'),
          component: AutoFormColorPicker,
        },
        {
          id: 'icon',
          label: t('icon.label'),
          description: t('icon.desc'),
          component: props => (
            <AutoFormFileInput
              {...props}
              accept="image/png, image/jpeg, image/webp"
              acceptExtensions={['png', 'jpg', 'webp', 'jpeg']}
              maxFileSizeInMb={1}
              showInfo
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      theme="horizontal"
    />
  );
};
