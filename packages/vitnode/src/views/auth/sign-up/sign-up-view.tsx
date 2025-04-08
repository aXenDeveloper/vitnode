import { Card, CardDescription } from '@/components/ui/card';
import { getMiddlewareApi } from '@/lib/api/get-middleware-api';
import { Link } from '@/lib/navigation';
import { getTranslations } from 'next-intl/server';
import { Metadata } from 'next/dist/types';
import React from 'react';

import { SSOButtons, SSOButtonsSkeleton } from '../sso/buttons/sso-buttons';
import { FormSignUp } from './form/form';

export const generateMetadataSignUpView = async (
  locale: string,
): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace: 'core.global' });

  return {
    title: t('register'),
  };
};

export const SignUpView = async () => {
  const [t, tGlobal, { isEmail }] = await Promise.all([
    getTranslations('core.auth.sign_up'),
    getTranslations('core.global'),
    getMiddlewareApi(),
  ]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
      <Card className="bg-muted gap-0 p-0">
        <div className="bg-card rounded-xl p-6">
          <div className="mb-10 space-y-2 text-center">
            <h1 className="text-2xl font-semibold leading-none tracking-tight">
              {tGlobal('register')}
            </h1>
            <CardDescription>{t('desc')}</CardDescription>
          </div>
          <FormSignUp isEmail={isEmail} />

          <React.Suspense fallback={<SSOButtonsSkeleton />}>
            <SSOButtons />
          </React.Suspense>
        </div>

        <div className="text-accent-foreground p-6 text-center text-sm">
          {t.rich('already_have_account', {
            link: text => (
              <Link className="font-semibold" href="/login">
                {text}
              </Link>
            ),
          })}
        </div>
      </Card>
    </div>
  );
};
