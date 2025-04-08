import { Card, CardDescription } from '@/components/ui/card';
import { Link } from '@/lib/navigation';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next/dist/types';
import React from 'react';

import { SSOButtons, SSOButtonsSkeleton } from '../sso/buttons/sso-buttons';
import { FormSignIn } from './form/form';

export const generateMetadataSignInView = async (
  locale: string,
): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: 'core.global' });

  return {
    title: t('login'),
  };
};

export const SignInView = () => {
  const t = useTranslations('core.auth.sign_in');
  const tGlobal = useTranslations('core.global');

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
      <Card className="bg-muted gap-0 p-0">
        <div className="bg-card rounded-xl p-6">
          <div className="mb-10 space-y-2 text-center">
            <h1 className="text-2xl font-semibold leading-none tracking-tight">
              {tGlobal('login')}
            </h1>
            <CardDescription>{t('desc')}</CardDescription>
          </div>
          <FormSignIn />

          <React.Suspense fallback={<SSOButtonsSkeleton />}>
            <SSOButtons />
          </React.Suspense>
        </div>

        <div className="text-accent-foreground p-6 text-center text-sm">
          {t.rich('do_not_have_account', {
            link: text => (
              <Link className="font-semibold" href="/register">
                {text}
              </Link>
            ),
          })}
        </div>
      </Card>
    </div>
  );
};
