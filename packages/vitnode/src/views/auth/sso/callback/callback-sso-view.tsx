import { ErrorView } from '@/views/error/error-view';
import { getTranslations } from 'next-intl/server';

import { ClientCallbackSSO } from './client/client';

export const CallbackSSOView = async ({
  providerId,
  searchParams,
}: {
  providerId: string;
  searchParams: Promise<Record<string, string>>;
}) => {
  const [{ code, error, state }, t] = await Promise.all([
    searchParams,
    getTranslations('core.auth.sso'),
  ]);

  if (error === 'access_denied') {
    return <ErrorView code={403} customDescription={t('access_denied')} />;
  }

  return (
    <ClientCallbackSSO code={code} providerId={providerId} state={state} />
  );
};
