'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, LogIn, MailQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

import { useSignInView } from './hooks/use-sign-in-view';

export const FormSignIn = () => {
  const t = useTranslations('core.sign_in');
  const tError = useTranslations('core.global.errors');
  const { error, formSchema, onSubmit } = useSignInView();

  return (
    <>
      {error && (
        <div className="mb-6 space-y-4">
          {error === 'EMAIL_NOT_VERIFIED' ? (
            <Alert variant="warn">
              <MailQuestion className="size-4" />
              <AlertTitle>{t('not_verified.title')}</AlertTitle>
              <AlertDescription>{t('not_verified.desc')}</AlertDescription>
            </Alert>
          ) : error === 'ACCESS_DENIED' ? (
            <Alert variant="error">
              <AlertCircle className="size-4" />
              <AlertTitle>{t('error.title')}</AlertTitle>
              <AlertDescription>{t('error.desc')}</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="error">
              <AlertCircle className="size-4" />
              <AlertTitle>{tError('title')}</AlertTitle>
              <AlertDescription>
                {tError('internal_server_error')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <AutoForm
        fields={[
          {
            id: 'email',
            label: t('email'),
            component: props => (
              <AutoFormInput
                {...props}
                className="bg-card shadow-sm"
                type="email"
              />
            ),
          },
          {
            id: 'password',
            label: t('password'),
            component: props => (
              <AutoFormInput
                {...props}
                className="bg-card shadow-sm"
                type="password"
              />
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButton={props => (
          <Button {...props} className="w-full">
            <LogIn /> {t('submit')}
          </Button>
        )}
      />
    </>
  );
};
