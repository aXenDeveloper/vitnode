import { Badge } from '@vitnode/core/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@vitnode/core/components/ui/table'
import { cn } from 'cn'
import {
  ArrowUpRight,
  Clock,
  Database,
  ListChecks,
  Mail,
  Radio,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import { AdminFrame } from './frames'
import { Meter, StaticButton, TableCard } from './parts'

export const IntegrationsScreen = () => {
  const t = useTranslations('site.home.hero.wall')
  const services = [
    { description: t('integrations.ai'), Icon: Sparkles, name: 'AI', ok: true },
    {
      description: t('integrations.websocket'),
      Icon: Radio,
      name: 'WebSocket',
      ok: true,
    },
    {
      description: t('integrations.redis'),
      Icon: Database,
      name: 'Redis',
      ok: true,
    },
    {
      description: t('integrations.email'),
      Icon: Mail,
      name: t('integrations.email_title'),
      ok: true,
    },
    {
      description: t('integrations.cron'),
      Icon: Clock,
      name: t('nav.cron'),
      ok: false,
    },
    {
      description: t('integrations.queue'),
      Icon: ListChecks,
      name: t('nav.queue'),
      ok: true,
    },
  ]

  return (
    <AdminFrame
      description={t('integrations.desc')}
      page="integrations"
      title={t('integrations.title')}
    >
      <div className="grid grid-cols-3 gap-4">
        {services.map(({ description, Icon, name, ok }) => (
          <Card
            className={cn(!ok && 'bg-warn/5 ring-warn/30')}
            key={name}
            size="sm"
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate">{name}</span>
                </span>
                <Badge variant={ok ? 'success' : 'warning'}>
                  {ok ? t('common.active') : t('integrations.unreachable')}
                </Badge>
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {description}
              </CardDescription>
            </CardHeader>
            <CardFooter className="bg-muted/50 justify-end">
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                {t('common.read_more')}
                <ArrowUpRight className="size-3.5" />
              </span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </AdminFrame>
  )
}

const FEATURES = [
  { key: 'translate', share: 46 },
  { key: 'summaries', share: 28 },
  { key: 'alt_text', share: 17 },
] as const

export const AiScreen = () => {
  const t = useTranslations('site.home.hero.wall.ai')
  const nav = useTranslations('site.home.hero.wall.nav')
  const format = useFormatter()
  const stats = [
    { label: t('points'), value: format.number(18_420) },
    { label: t('requests'), value: format.number(3912) },
    { label: t('budget'), value: format.number(0.62, { style: 'percent' }) },
  ]

  return (
    <AdminFrame
      badge={
        <Badge variant="success">
          <Sparkles />
          {t('models', { count: 2 })}
        </Badge>
      }
      description={t('desc')}
      page="ai_overview"
      title={nav('ai')}
    >
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value }) => (
          <Card key={label} size="sm">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          {FEATURES.map(({ key, share }) => (
            <div className="flex flex-col gap-1.5" key={key}>
              <span className="flex justify-between text-sm">
                {t(key)}
                <span className="text-muted-foreground tabular-nums">
                  {format.number(share / 100, { style: 'percent' })}
                </span>
              </span>
              <Meter value={share} />
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminFrame>
  )
}

const CRON_BADGE = {
  failed: 'destructive',
  healthy: 'success',
  running: 'secondary',
} as const

export const CronScreen = () => {
  const t = useTranslations('site.home.hero.wall')
  const jobs = [
    {
      name: t('cron.sessions'),
      next: t('cron.in_minutes', { count: 12 }),
      schedule: t('cron.hourly'),
      status: 'healthy',
    },
    {
      name: t('cron.digest'),
      next: t('cron.tomorrow'),
      schedule: t('cron.weekly'),
      status: 'healthy',
    },
    {
      name: t('cron.search'),
      next: t('cron.in_hours', { count: 3 }),
      schedule: t('cron.six_hours'),
      status: 'running',
    },
    {
      name: t('cron.files'),
      next: t('cron.tomorrow'),
      schedule: t('cron.daily'),
      status: 'failed',
    },
  ] as const

  return (
    <AdminFrame description={t('cron.desc')} page="cron" title={t('nav.cron')}>
      <div className="bg-card flex items-center gap-3 rounded-lg border p-4">
        <span className="bg-success size-2.5 rounded-full" />
        <span className="flex-1 text-sm font-medium">
          {t('cron.scheduler')}
        </span>
        <span className="text-muted-foreground text-sm">
          {t('cron.last_tick', { count: 14 })}
        </span>
      </div>
      <TableCard>
        <TableHeader>
          <TableRow>
            <TableHead>{t('cron.job')}</TableHead>
            <TableHead>{t('cron.next_run')}</TableHead>
            <TableHead>{t('cron.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map(({ name, next, schedule, status }) => (
            <TableRow key={name}>
              <TableCell>
                <span className="flex flex-col">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground text-xs">
                    {schedule}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{next}</TableCell>
              <TableCell>
                <Badge variant={CRON_BADGE[status]}>
                  {t(`cron.${status}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableCard>
    </AdminFrame>
  )
}

const INDEXED = [
  { count: 1240, key: 'articles' },
  { count: 1285, key: 'users' },
  { count: 38, key: 'categories' },
] as const

const LARGEST_INDEX = Math.max(...INDEXED.map(({ count }) => count))

export const SearchScreen = () => {
  const t = useTranslations('site.home.hero.wall')
  const format = useFormatter()

  return (
    <AdminFrame
      actions={
        <StaticButton>
          <RefreshCw />
          {t('search.reindex')}
        </StaticButton>
      }
      description={t('search.desc')}
      page="search"
      title={t('nav.search')}
    >
      <div className="grid grid-cols-2 gap-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t('search.documents')}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {format.number(2563)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{t('search.engine')}</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-success size-2 rounded-full" />
              {t('search.engine_value')}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      <TableCard>
        <TableHeader>
          <TableRow>
            <TableHead>{t('search.type')}</TableHead>
            <TableHead className="w-80">{t('search.documents')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INDEXED.map(({ count, key }) => (
            <TableRow key={key}>
              <TableCell className="font-medium">{t(`nav.${key}`)}</TableCell>
              <TableCell>
                <span className="flex items-center gap-3">
                  <Meter value={(count / LARGEST_INDEX) * 100} />
                  <span className="text-muted-foreground w-12 text-right tabular-nums">
                    {format.number(count)}
                  </span>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableCard>
      <span className="text-muted-foreground text-sm">
        {t('search.rebuilt', { count: 3 })}
      </span>
    </AdminFrame>
  )
}
