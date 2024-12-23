'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormSelect } from '@/components/form/fields/select';
import { Badge } from '@/components/ui/badge';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { DescFieldContentMainSettingsCoreAdmin } from './components/desc';
import { useSettingsCoreAdmin } from './hooks/use-settings-core-admin';

export const ContentMainSettingsCoreAdmin = (props: ShowMiddlewareObj) => {
  const t = useTranslations('admin.core.settings.main');
  const { onSubmit, formSchema } = useSettingsCoreAdmin(props);

  return (
    <AutoForm
      fields={[
        {
          id: 'site_name',
          component: props => (
            <>
              <AutoFormInput {...props} />
              <div className="flex w-32 items-center justify-start">
                <TooltipWrapper content={t('name.seo')}>
                  <Badge
                    className="mt-1"
                    variant={
                      props.field.value.length <= 50 &&
                      props.field.value.length >= 3
                        ? 'outline'
                        : props.field.value.length > 60 ||
                            props.field.value.length < 3
                          ? 'destructive'
                          : 'default'
                    }
                  >
                    {props.field.value.length}/60
                  </Badge>
                </TooltipWrapper>
              </div>
            </>
          ),
          label: t('name.label'),
        },
        {
          id: 'site_short_name',
          component: props => (
            <>
              <AutoFormInput {...props} />
              <div className="flex w-32 items-center justify-start">
                <TooltipWrapper content={t('short_name.seo')}>
                  <Badge
                    className="mt-1"
                    variant={
                      props.field.value.length <= 5 &&
                      props.field.value.length >= 3
                        ? 'outline'
                        : props.field.value.length > 20 ||
                            props.field.value.length < 3
                          ? 'destructive'
                          : 'default'
                    }
                  >
                    {props.field.value.length}/20
                  </Badge>
                </TooltipWrapper>
              </div>
            </>
          ),
          label: t('short_name.label'),
        },
        {
          id: 'site_description',
          component: componentProps => (
            <DescFieldContentMainSettingsCoreAdmin
              {...componentProps}
              defaultLanguage={props.languages_code_default}
            />
          ),
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
        {
          id: 'app_type',
          label: t('app_type.label'),
          component: AutoFormSelect,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      theme="horizontal"
    />
  );
};
