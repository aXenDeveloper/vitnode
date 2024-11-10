'use client';

import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormRadioGroup } from '@/components/form/fields/radio-group';
import { Link } from '@/navigation';
import { SquareArrowOutUpRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShowCaptchaSecurityAdminObj } from 'vitnode-shared/admin/security/captcha.dto';

import { useCaptchaSecurityAdmin } from './hooks/use-captcha-security-admin';

export const ContentCaptchaSpamSecurityAdmin = (
  data: ShowCaptchaSecurityAdminObj,
) => {
  const { formSchema, onSubmit } = useCaptchaSecurityAdmin(data);
  const t = useTranslations('admin.core.security.spam.captcha');

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'type',
          type: DependencyType.HIDES,
          targetField: 'site_key',
          when: (type: string) => type === 'none',
        },
        {
          sourceField: 'type',
          type: DependencyType.HIDES,
          targetField: 'secret_key',
          when: (type: string) => type === 'none',
        },
        {
          sourceField: 'type',
          type: DependencyType.REQUIRES,
          targetField: 'site_key',
          when: (type: string) => type !== 'none',
        },
        {
          sourceField: 'type',
          type: DependencyType.REQUIRES,
          targetField: 'secret_key',
          when: (type: string) => type !== 'none',
        },
      ]}
      fields={[
        {
          id: 'type',
          label: t('type.title'),
          component: props => (
            <AutoFormRadioGroup
              {...props}
              labels={{
                none: {
                  title: t('type.none.title'),
                },
                cloudflare_turnstile: {
                  title: t('type.cloudflare_turnstile.title'),
                  description: t.rich(`type.cloudflare_turnstile.desc`, {
                    link: text => (
                      <Link
                        className="flex items-center gap-1"
                        href="https://www.cloudflare.com/products/turnstile/"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {text}
                        <SquareArrowOutUpRightIcon className="size-3" />
                      </Link>
                    ),
                  }),
                },
                recaptcha_v3: {
                  title: t('type.recaptcha_v3'),
                  description: t.rich(`type.recaptcha_desc`, {
                    link: text => (
                      <Link
                        className="flex items-center gap-1"
                        href="https://www.google.com/recaptcha/about/"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {text}
                        <SquareArrowOutUpRightIcon className="size-3" />
                      </Link>
                    ),
                  }),
                },
                recaptcha_v2_invisible: {
                  title: t('type.recaptcha_v2_invisible'),
                  description: t.rich(`type.recaptcha_desc`, {
                    link: text => (
                      <Link
                        className="flex items-center gap-1"
                        href="https://www.google.com/recaptcha/about/"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {text}
                        <SquareArrowOutUpRightIcon className="size-3" />
                      </Link>
                    ),
                  }),
                },
                recaptcha_v2_checkbox: {
                  title: t('type.recaptcha_v2_checkbox'),
                  description: t.rich(`type.recaptcha_desc`, {
                    link: text => (
                      <Link
                        className="flex items-center gap-1"
                        href="https://www.google.com/recaptcha/about/"
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {text}
                        <SquareArrowOutUpRightIcon className="size-3" />
                      </Link>
                    ),
                  }),
                },
              }}
            />
          ),
        },
        {
          id: 'site_key',
          label: t('site_key'),
          component: AutoFormInput,
        },
        {
          id: 'secret_key',
          label: t('secret_key'),
          component: AutoFormInput,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      theme="horizontal"
    />
  );
};
