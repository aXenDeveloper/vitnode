import { fetcher } from '@/api/fetcher';
import { redirect } from '@/navigation';
import { notFound } from 'next/navigation';
import { SSOUrlAuthObj } from 'vitnode-shared/auth/sso.dto';

export const UrlSSOAuthView = async ({ provider }: { provider: string }) => {
  let url = '';
  try {
    const { data } = await fetcher<SSOUrlAuthObj>({
      url: `/core/auth/sso/${provider}`,
    });

    url = data.url;
  } catch (_) {
    notFound();
  }

  if (!url) {
    notFound();
  }

  await redirect(url);

  return <></>;
};
