import { getTranslationForEmail } from '@/helpers/email/email';
import { GetHelpersForEmailType } from '@/helpers/email/email-helpers.type';
import { Button, Text } from '@react-email/components';
import React from 'react';

export const ConfirmEmailTemplate = ({
  user,
  helpers,
  token,
}: {
  helpers: GetHelpersForEmailType;
  token: string;
  user: {
    id: number;
    language: string;
  };
}) => {
  const t = getTranslationForEmail(
    'core.sign_up.confirm_email.mail',
    user.language,
  );

  return (
    <>
      <Text className="font-bold">{t('welcome')}</Text>
      <Text>{t('desc')}</Text>
      <Button
        className={`bg-${helpers.color.primary.DEFAULT} rounded-md text-sm font-medium text-${helpers.color.primary.foreground} px-4 py-2.5`}
        href={`${helpers.frontend_url}/register/confirm-email?userId=${user.id}&token=${token}`}
      >
        {t('button')}
      </Button>
      <Text>{t('ignore')}</Text>
    </>
  );
};
