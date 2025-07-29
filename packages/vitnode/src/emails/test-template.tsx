import { Button, Text } from '@react-email/components';
import { createTranslator } from 'use-intl';

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from './default-template';

export default function TestTemplateEmail({
  messages,
  locale,
  ...props
}: DefaultTemplateEmailProps) {
  const t = createTranslator({ locale, messages });

  return (
    <DefaultTemplateEmail locale={locale} messages={messages} {...props}>
      <Text>Hello - {t('core.auth.sign_in.desc')}</Text>
      <Button
        className="bg-primary px-3 py-2 font-medium leading-4 text-white"
        href="https://example.com"
      >
        Click me
      </Button>
    </DefaultTemplateEmail>
  );
}

TestTemplateEmail.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  messages: {
    core: {
      auth: {
        sign_in: {
          desc: 'Sign in to your account to access exclusive features and content.',
        },
      },
    },
  },
} satisfies DefaultTemplateEmailProps;
