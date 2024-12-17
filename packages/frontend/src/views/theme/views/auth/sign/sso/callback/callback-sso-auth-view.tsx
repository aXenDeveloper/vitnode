'use client';

import { fetcherClient } from '@/api/fetcher-client';
import { Loader } from '@/components/ui/loader';
import { useRouter } from '@/navigation';
import { useQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { SSOCallbackAuthObj } from 'vitnode-shared/auth/sso.dto';

import { ErrorView } from '../../../../error/error-view';
import { revalidateApi } from './hooks/revalidate-api';
import { NameFormCallbackSSO } from './name-form';

export const CallbackSSOAuthView = ({
  provider,
  code,
}: {
  code: string;
  provider: string;
}) => {
  const { replace } = useRouter();
  if (!code || !provider) {
    notFound();
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['core.auth.sso.callback', provider, code],
    queryFn: async () => {
      const { data } = await fetcherClient<SSOCallbackAuthObj>({
        method: 'POST',
        url: `/core/auth/sso/${provider}/callback?code=${code}`,
      });
      await revalidateApi();

      if (data.login_token) {
        replace('/');
      }

      return data;
    },
    retry: 0,
  });

  if (isLoading || data?.login_token) {
    return (
      <div className="container my-6 sm:my-10">
        <Loader />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorView code="403" />;
  }

  return <NameFormCallbackSSO {...data} />;
};
