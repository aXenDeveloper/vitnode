import { getTranslations } from 'next-intl/server';

import { ErrorView } from '@/views/error/error-view';

import { ClientCallbackSSO } from './client/client';

export const CallbackSSOView = async ({
  providerId,
  searchParams: { code, error, state },
}: {
  providerId: string;
  searchParams: Record<string, string>;
}) => {
  const t = await getTranslations('core.auth.sso');

  if (error === 'access_denied') {
    return <ErrorView code={403} customDescription={t('access_denied')} />;
  }

  return (
    <ClientCallbackSSO code={code} providerId={providerId} state={state} />
  );
};
