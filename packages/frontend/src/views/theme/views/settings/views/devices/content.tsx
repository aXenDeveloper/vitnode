import { DateFormat } from '@/components/date-format';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Monitor, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShowDevicesSettingsAuthObj } from 'vitnode-shared/auth/settings/devices.dto';

const getDeviceIcon = (device: string) => {
  if (
    device.includes('Android') ||
    device.includes('Windows Phone') ||
    device.includes('iPhone') ||
    device.includes('iPad')
  ) {
    return <Smartphone />;
  }

  return <Monitor />;
};

export const ContentDevicesSettings = ({
  data,
  loginToken,
}: {
  data: ShowDevicesSettingsAuthObj[];
  loginToken: string;
}) => {
  const t = useTranslations('core.settings.devices');

  return (
    <div className="space-y-6">
      {data.map(device => (
        <div className="space-y-4 rounded-md border p-6" key={device.id}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-primary/10 [&>svg]:text-primary flex shrink-0 items-center justify-center rounded-sm p-2 [&>svg]:size-8">
              {getDeviceIcon(device.uagent_os)}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-medium leading-none">
                  {device.uagent_os}
                </h3>
                {loginToken === device.login_token ? (
                  <Badge>{t('current_device')}</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm">
                {t.rich('last_active', {
                  time: () => <DateFormat date={device.last_seen} />,
                })}
              </p>
            </div>
          </div>

          <Separator />

          <ul className="[&>li>div:first-child]:text-muted-foreground space-y-2 sm:[&>li>div:first-child]:w-52 sm:[&>li>div:first-child]:flex-shrink-0 [&>li>div]:truncate [&>li]:flex [&>li]:flex-col [&>li]:gap-1 sm:[&>li]:flex-row sm:[&>li]:gap-4">
            <li>
              <div>{t('browser')}</div>
              <div>
                {device.uagent_browser} {device.uagent_version}
              </div>
            </li>

            <li>
              <div>{t('ip_address')}</div>
              <div>{device.ip_address}</div>
            </li>

            <li>
              <div>{t('session_expires')}</div>
              <div>
                <DateFormat date={device.expires_at} showFullDate />
              </div>
            </li>
          </ul>
        </div>
      ))}
    </div>
  );
};
