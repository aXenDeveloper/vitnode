import { fetcher } from '@/api/fetcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { CircleCheckIcon, LogIn } from 'lucide-react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { VerifyConfirmEmailAuthQuery } from 'vitnode-shared/auth/auth.dto';

const getData = async (query: VerifyConfirmEmailAuthQuery) => {
  try {
    await fetcher<object, VerifyConfirmEmailAuthQuery>({
      url: '/core/auth/verify_confirm_email',
      query,
    });
  } catch (_) {
    notFound();
  }
};

export const metadataConfirmEmailSignUp: Metadata = {
  robots: 'noindex, nofollow',
};

export const ConfirmEmailSignUpView = async ({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    userId?: string;
  }>;
}) => {
  const [t, { userId, token }] = await Promise.all([
    getTranslations('core.sign_up.confirm_email'),
    searchParams,
  ]);

  if (!userId || !token) {
    notFound();
  }

  await getData({
    token,
    user_id: +userId,
  });

  return (
    <div className="bg-background container flex max-w-xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8">
      <CircleCheckIcon className="mx-auto size-16 text-green-500" />
      <h1 className="text-foreground mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        {t('title')}
      </h1>
      <p className="text-muted-foreground mt-4">{t('desc')}</p>

      <Button asChild className="mt-6" size="lg">
        <Link href="/login">
          <LogIn />
          {t('sign_in')}
        </Link>
      </Button>
    </div>
  );
};
