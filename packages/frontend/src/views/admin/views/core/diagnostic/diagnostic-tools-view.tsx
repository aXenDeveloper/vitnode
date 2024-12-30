import { getMiddlewareData } from '@/api/get-middleware-data';
import { checkAdminPermissionPage } from '@/api/get-session-admin-data';
import { SkeletonDataTable } from '@/components/data-table/skeleton';
import { TranslationsProvider } from '@/components/translations-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { Link } from '@/navigation';
import {
  CheckIcon,
  MailIcon,
  ShieldIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import { WarnReqRestartServer } from '../warn-req-restart-server';
import { ActionsDiagnosticTools } from './actions/actions';
import { LogsDiagnosticToolsView } from './logs/logs-diagnostic-tools-view';

const permission = {
  plugin_code: 'core',
  group: 'dashboard',
  permission: 'can_manage_diagnostic_tools',
};

export const generateMetadataDiagnosticAdmin = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.core.diagnostic');

  return {
    title: t('title'),
  };
};

export const DiagnosticToolsView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) => {
  const perm = await checkAdminPermissionPage(permission);
  if (perm) return perm;
  const t = await getTranslations('admin.core.diagnostic');
  const middleware = await getMiddlewareData();

  const quickLook = [
    {
      id: 'captcha' as const,
      icon: <ShieldIcon className="size-5" />,
      href: 'https://vitnode.com/docs/guides/captcha',
      enable: middleware.security.captcha.type,
    },
    {
      id: 'email' as const,
      icon: <MailIcon className="size-5" />,
      href: 'https://vitnode.com/docs/dev/email',
      enable: middleware.is_email_enabled,
    },
    {
      id: 'ai' as const,
      icon: <SparklesIcon className="size-5" />,
      href: 'https://vitnode.com/docs/dev/ai',
      enable: middleware.is_ai_enabled,
    },
  ];

  return (
    <TranslationsProvider namespaces="admin.core.diagnostic">
      <HeaderContent desc={t('desc')} h1={t('title')}>
        <ActionsDiagnosticTools />
      </HeaderContent>

      <WarnReqRestartServer />

      <div className="mb-10 grid auto-rows-min gap-4 md:grid-cols-3">
        {quickLook.map(item => (
          <Card className="p-6" key={item.id}>
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-1">
                <h3 className="flex items-center gap-2 font-semibold leading-none tracking-tight">
                  {item.icon}
                  {t(`${item.id}.title`)}
                </h3>
                <CardDescription>{t(`${item.id}.desc`)}</CardDescription>
              </div>

              {item.enable ? (
                <Badge variant="outline">
                  Enable <CheckIcon className="size-4" />
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Disable <XIcon className="size-4" />
                </Badge>
              )}
            </div>

            {!item.enable && (
              <Button
                asChild
                className="mt-4 w-full"
                size="sm"
                variant="outline"
              >
                <Link
                  href={item.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('how_to_enable')}
                </Link>
              </Button>
            )}
          </Card>
        ))}
      </div>

      <HeaderContent desc={t('error_logs.desc')} h2={t('error_logs.title')} />

      <React.Suspense fallback={<SkeletonDataTable />}>
        <LogsDiagnosticToolsView searchParams={searchParams} />
      </React.Suspense>
    </TranslationsProvider>
  );
};
