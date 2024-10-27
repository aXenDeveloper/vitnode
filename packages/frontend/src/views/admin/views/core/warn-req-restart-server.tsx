import { getSessionAdminData } from '@/api/get-session-admin-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlertIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export const WarnReqRestartServer = async () => {
  const [t, { restart_server }] = await Promise.all([
    await getTranslations('admin.core.plugins.warn_req_restart_server'),
    await getSessionAdminData(),
  ]);

  if (!restart_server) {
    return null;
  }

  return (
    <Alert className="mb-6" variant="warn">
      <TriangleAlertIcon />
      <AlertTitle>{t('title')}</AlertTitle>
      <AlertDescription>
        {t.rich('desc', {
          bold: text => <span className="font-bold">{text}</span>,
        })}
      </AlertDescription>
    </Alert>
  );
};
