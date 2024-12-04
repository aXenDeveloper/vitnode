import { CircleCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const SuccessForgotPassword = ({ email }: { email: string }) => {
  const t = useTranslations('core.sign_in.forgot_password.success');

  return (
    <>
      <CircleCheckIcon className="mx-auto size-16 text-green-500" />
      <div className="mt-4 space-y-2 text-center">
        <span className="text-3xl font-semibold">{t('title')}</span>
        <p className="text-muted-foreground">
          {t.rich('desc', {
            email: () => (
              <span className="text-primary font-semibold">{email}</span>
            ),
          })}
        </p>
        <p className="text-muted-foreground">{t('warning')}</p>
      </div>
    </>
  );
};
