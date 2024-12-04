import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { CircleCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const SuccessResetPassword = () => {
  const t = useTranslations(
    'core.sign_in.forgot_password.change_password.success',
  );

  return (
    <>
      <CircleCheckIcon className="mx-auto size-16 text-green-500" />
      <div className="mt-4 text-center">
        <span className="text-3xl font-semibold">{t('title')}</span>
        <p className="text-muted-foreground">{t('desc')}</p>

        <Button asChild className="mt-4">
          <Link href="/login">{t('sign_in')}</Link>
        </Button>
      </div>
    </>
  );
};
