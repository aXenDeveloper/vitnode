import { fetcher } from '@/api/fetcher';
import {
  getSessionAdminData,
  isInAdminPermission,
} from '@/api/get-session-admin-data';
import { DateFormat } from '@/components/date-format';
import { TranslationsProvider } from '@/components/translations-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { CONFIG } from '@/helpers/config-with-env';
import { Link } from '@/navigation';
import { AlertTriangle, HammerIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ShowDashboardAdminObj } from 'vitnode-shared/admin/dashboard.dto';

import { WarnReqRestartServer } from '../warn-req-restart-server';
import { NewUsersChart } from './new-users-chart';
import { NoteForm } from './note-admin/note-form';

const getData = async () => {
  const { data } = await fetcher<ShowDashboardAdminObj>({
    url: '/admin/dashboard',
    cache: 'force-cache',
  });

  return data;
};

export const DashboardCoreAdminView = async () => {
  const [{ version_of_vitnode }, tGlobal, t, data] = await Promise.all([
    getSessionAdminData(),
    getTranslations('admin.global'),
    getTranslations('admin.dashboard'),
    getData(),
  ]);

  return (
    <TranslationsProvider namespaces="admin.dashboard">
      <HeaderContent
        desc={tGlobal('version', { version: version_of_vitnode })}
        h1={
          <>
            <span>VitNode</span>
            {CONFIG.node_development && (
              <Badge
                className="ml-2 bg-yellow-500 text-black hover:bg-yellow-500"
                variant="destructive"
              >
                <AlertTriangle className="size-4" /> {tGlobal('dev_mode')}
              </Badge>
            )}
          </>
        }
      >
        {(await isInAdminPermission({
          plugin_code: 'core',
          group: 'dashboard',
          permission: 'can_manage_diagnostic_tools',
        })) && (
          <Button asChild>
            <Link href="/admin/core/diagnostic">
              <HammerIcon />
              {tGlobal('diagnostic_tools')}
            </Link>
          </Button>
        )}
      </HeaderContent>

      <WarnReqRestartServer />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('new_users.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <NewUsersChart data={data.new_users} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('note.title')}</CardTitle>
            <CardDescription>
              {t.rich('note.last_updated', {
                date: () => <DateFormat date={data.note.updated_at} />,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NoteForm data={data.note} />
          </CardContent>
        </Card>
      </div>
    </TranslationsProvider>
  );
};
