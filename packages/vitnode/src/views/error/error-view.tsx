import { Button } from '@/components/ui/button';
import { Link } from '@/lib/navigation';
import { ArrowLeft, HomeIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BackButtonNotFound } from './back-button';

export const ErrorView = ({
  code,
  customDescription,
}: {
  code: 400 | 403 | 404 | 500;
  customDescription?: string;
}) => {
  const t = useTranslations('core.global');

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 sm:py-20">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-primary text-8xl font-bold">{code}</h1>
          <h2 className="text-2xl font-medium">{t(`errors.${code}.title`)}</h2>
          <p className="text-muted-foreground">
            {customDescription ?? t(`errors.${code}.desc`)}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <BackButtonNotFound>
            <ArrowLeft />
            {t('go_back')}
          </BackButtonNotFound>

          <Button asChild size="lg">
            <Link href="/">
              <HomeIcon />
              {t('back_home')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
