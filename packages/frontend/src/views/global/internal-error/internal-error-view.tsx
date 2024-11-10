'use client';

import { RefreshCcw, RotateCcw, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '../../../components/ui/card';
import { CONFIG } from '../../../helpers/config-with-env';
import { useRouter } from '../../../navigation';
import { mutationClearCache } from './mutation-clear-cache';

export const InternalErrorView = () => {
  const t = useTranslations('core.global');
  const { back } = useRouter();

  return (
    <div className="mx-auto my-10 max-w-2xl px-4">
      <Card>
        <CardHeader className="items-center pb-2">
          <WifiOff className="size-16" />
        </CardHeader>
        <CardContent className="flex flex-col items-center pb-4 text-center">
          <span className="text-muted-foreground">{t('errors.title')}</span>

          <p className="mt-1 text-xl font-semibold tracking-tight">
            {t('errors.no_connection_api')}
          </p>

          {CONFIG.node_development && (
            <p className="text-muted-foreground mt-10 max-w-96 text-sm">
              {t('errors.no_connection_api_dev')}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col flex-wrap items-stretch justify-center gap-2 sm:flex-row">
          <Button onClick={back} variant="ghost">
            <RotateCcw /> {t('go_back')}
          </Button>

          <Button
            onClick={async () => {
              if (CONFIG.node_development) {
                await mutationClearCache();
              }

              window.location.reload();
            }}
          >
            <RefreshCcw />
            {t(
              CONFIG.node_development
                ? 'errors.clear_cache_and_reload'
                : 'errors.reload_page',
            )}
          </Button>
        </CardFooter>
      </Card>
      <div className="text-muted-foreground pt-2 text-right italic">
        {t.rich('errors.code', {
          code: () => <span className="font-semibold">{500}</span>,
        })}
      </div>
    </div>
  );
};
