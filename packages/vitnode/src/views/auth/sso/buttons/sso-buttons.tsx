import { Skeleton } from '@/components/ui/skeleton';
import { getMiddlewareApi } from '@/lib/api/get-middleware-api';
import { getTranslations } from 'next-intl/server';

import { ButtonSSOButtons } from './client';

export const SSOButtonsSkeleton = () => {
  return (
    <div className="flex gap-4">
      <Skeleton className="mt-6 h-8 w-full" />
      <Skeleton className="mt-6 h-8 w-full" />
    </div>
  );
};

export const SSOButtons = async () => {
  const t = await getTranslations('core.auth.sso');
  const { sso } = await getMiddlewareApi();

  return (
    <>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card text-muted-foreground px-4">{t('or')}</span>
        </div>
      </div>

      {sso.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-4">
          {sso.map(provider => (
            <ButtonSSOButtons key={provider.id} providerId={provider.id}>
              {provider.name}
            </ButtonSSOButtons>
          ))}
        </div>
      )}
    </>
  );
};
