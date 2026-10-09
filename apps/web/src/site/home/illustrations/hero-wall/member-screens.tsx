import { Badge } from '@vitnode/core/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import { Input } from '@vitnode/core/components/ui/input'
import { cn } from 'cn'
import { Laptop, Monitor, Smartphone } from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import { SCREEN, SettingsFrame } from './frames'
import { Field, Initials, ListRow, StaticButton, utcDate } from './parts'

export const LoginScreen = () => {
  const t = useTranslations('site.home.hero.wall.login')

  return (
    <div className={cn(SCREEN, 'bg-muted/40 items-center justify-center')}>
      <Card className="w-96 pb-0">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">{t('title')}</CardTitle>
          <CardDescription>{t('desc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label={t('email')}>
            <Input readOnly value="maya@yourcommunity.com" />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="flex justify-between text-sm font-medium">
              {t('password')}
              <span className="text-primary">{t('forgot')}</span>
            </span>
            <Input readOnly type="password" value="correct-horse-battery" />
          </div>
          <StaticButton className="w-full" size="default" variant="default">
            {t('submit')}
          </StaticButton>
          <div className="grid grid-cols-2 gap-2">
            <StaticButton className="w-full">Discord</StaticButton>
            <StaticButton className="w-full">Google</StaticButton>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 justify-center gap-1 text-sm">
          {t('no_account')}
          <span className="text-primary font-medium">{t('sign_up')}</span>
        </CardFooter>
      </Card>
    </div>
  )
}

const Row = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => (
  <ListRow>
    <span className="w-32 shrink-0 text-sm font-medium">{label}</span>
    <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm">
      {children}
    </span>
  </ListRow>
)

export const ProfileScreen = () => {
  const t = useTranslations('site.home.hero.wall')
  const format = useFormatter()

  return (
    <SettingsFrame page="overview">
      <Card className="flex-row items-center gap-4 px-4" size="sm">
        <Initials
          className="bg-primary text-primary-foreground size-12 text-base"
          initials="MA"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">Maya Andersen</span>
          <span className="text-muted-foreground text-sm">
            {t('settings.member_since', {
              date: format.dateTime(utcDate('2025-03-14'), {
                month: 'long',
                timeZone: 'UTC',
                year: 'numeric',
              }),
            })}
          </span>
        </span>
        <StaticButton>{t('settings.edit_profile')}</StaticButton>
      </Card>
      <Card className="py-0" size="sm">
        <Row label={t('settings.email')}>maya@yourcommunity.com</Row>
        <Row label={t('settings.role')}>{t('roles.administrator')}</Row>
        <Row label={t('settings.language')}>{t('common.english')}</Row>
        <Row label={t('settings.time_zone')}>
          {t('settings.time_zone_value')}
        </Row>
      </Card>
    </SettingsFrame>
  )
}

export const DevicesScreen = () => {
  const t = useTranslations('site.home.hero.wall.settings')
  const devices = [
    {
      current: true,
      Icon: Laptop,
      meta: `Warsaw, Poland · ${t('active_now')}`,
      name: 'Chrome · macOS',
    },
    {
      current: false,
      Icon: Smartphone,
      meta: `Kraków, Poland · ${t('days_ago', { count: 1 })}`,
      name: 'Safari · iOS',
    },
    {
      current: false,
      Icon: Monitor,
      meta: `Berlin, Germany · ${t('days_ago', { count: 3 })}`,
      name: 'Firefox · Windows',
    },
  ]

  return (
    <SettingsFrame page="devices">
      <Card className="py-0" size="sm">
        {devices.map(({ current, Icon, meta, name }) => (
          <ListRow key={name}>
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-4" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="flex items-center gap-2 text-sm font-medium">
                {name}
                {current && <Badge variant="success">{t('this_device')}</Badge>}
              </span>
              <span className="text-muted-foreground text-xs">{meta}</span>
            </span>
            {!current && (
              <StaticButton variant="ghost">{t('sign_out')}</StaticButton>
            )}
          </ListRow>
        ))}
      </Card>
      <StaticButton className="w-fit">{t('sign_out_all')}</StaticButton>
    </SettingsFrame>
  )
}
