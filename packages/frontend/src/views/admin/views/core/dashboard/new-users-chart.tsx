'use client';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from 'recharts';
import { ShowDashboardAdminObj } from 'vitnode-shared/admin/dashboard.dto';

export const NewUsersChart = ({
  data,
}: {
  data: ShowDashboardAdminObj['new_users'];
}) => {
  const t = useTranslations('admin.dashboard.new_users');
  const format = useFormatter();
  const currentLocale = useLocale();
  const { languages } = useMiddlewareData();
  const currentLanguage = languages.find(
    language => language.code === currentLocale,
  );

  return (
    <ChartContainer
      config={{
        users: {
          label: t('users'),
          color: 'hsl(var(--chart-1))',
        },
      }}
    >
      <BarChart
        accessibilityLayer
        data={data.map(item => ({
          date: item.date,
          users: item.count,
        }))}
        margin={{
          top: 20,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="date"
          tickFormatter={(value: string) =>
            format.dateTime(new Date(value), {
              month: 'short',
              day: 'numeric',
              timeZone: currentLanguage?.timezone,
            })
          }
          tickLine={false}
          tickMargin={10}
        />
        <ChartTooltip
          content={<ChartTooltipContent hideLabel />}
          cursor={false}
        />
        <Bar dataKey="users" fill="var(--color-users)" radius={8}>
          <LabelList
            className="fill-foreground"
            fontSize={12}
            offset={12}
            position="top"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
};
