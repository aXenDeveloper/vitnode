import { Section } from '@react-email/components';
import { createTranslator } from 'use-intl';

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from './default-template';
import { Button } from './ui/button';
import { Card } from './ui/card';

export default function TestTemplateEmail({
  messages,
  locale,
  ...props
}: DefaultTemplateEmailProps) {
  const t = createTranslator({ locale, messages });

  return (
    <DefaultTemplateEmail locale={locale} messages={messages} {...props}>
      <Card className="p-6">
        {(
          [
            { variant: 'default', label: 'Default', size: 'lg' as const },
            { variant: 'secondary', label: 'Secondary' },
            { variant: 'outline', label: 'Outline' },
            { variant: 'ghost', label: 'Ghost' },
            { variant: 'link', label: 'Link' },
            {
              variant: 'destructive',
              label: 'Destructive',
              size: 'sm' as const,
            },
          ] as {
            label: string;
            size?: 'lg' | 'sm';
            variant:
              | 'default'
              | 'destructive'
              | 'ghost'
              | 'link'
              | 'outline'
              | 'secondary';
          }[]
        ).map(({ variant, label, size }) => (
          <Section className="mb-2" key={variant}>
            <Button
              href="http://localhost:3000/api/swagger"
              size={size}
              variant={variant}
            >
              {label}
            </Button>
          </Section>
        ))}
      </Card>
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
