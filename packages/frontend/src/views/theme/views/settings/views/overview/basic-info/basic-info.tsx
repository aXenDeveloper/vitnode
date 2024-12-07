import { getSessionData } from '@/api/get-session-data';
import { DateFormat } from '@/components/date-format';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

export const BasicInfoOverviewSettings = async () => {
  const [t, { user }] = await Promise.all([
    getTranslations('core.settings.overview.basic_info'),
    getSessionData(),
  ]);
  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold leading-none tracking-tight">
          {t('title')}
        </h2>
      </CardHeader>

      <CardContent className="[&_dd]:text-muted-foreground space-y-4 [&_dt]:font-semibold">
        <dl>
          <dt>{t('email')}</dt>
          <dd>{user.email}</dd>
        </dl>

        <dl>
          <dt>{t('joined_at')}</dt>
          <dd>
            <DateFormat date={user.joined_at} showFullDate />
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
};
