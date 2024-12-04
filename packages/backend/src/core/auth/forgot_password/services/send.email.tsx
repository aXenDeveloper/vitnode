import { getTranslationForEmail } from '@/helpers/email/email';
import { GetHelpersForEmailType } from '@/helpers/email/email-helpers.type';
import { Button, Text } from '@react-email/components';
import React from 'react';

export const SendForgotPasswordTemplateEmail = ({
  user,
  helpers,
  token,
}: {
  helpers: GetHelpersForEmailType;
  token: string;
  user: {
    id: number;
    language: string;
    name: string;
  };
}) => {
  const t = getTranslationForEmail(
    'core.sign_in.forgot_password.content_email',
    user.language,
  );

  return (
    <>
      <Text>{t('p')}</Text>
      <Button
        className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium"
        href={`${helpers.frontend_url}/login/forgot-password?userId=${user.id}&token=${token}`}
      >
        {t('button')}
      </Button>
      <Text>{t('security')}</Text>
    </>
  );
};
