import type { LucideIcon } from 'lucide-react'

import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { Badge } from '@vitnode/core/components/ui/badge'
import { buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import {
  CircleCheck,
  Ellipsis,
  FilePen,
  ImageIcon,
  LayoutDashboard,
  List,
  Pencil,
  Plus,
  Search,
  SquarePen,
  Users,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

import { MEMBER_TONE, SceneAvatar } from '@/site/home/illustrations/bento/scene'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

const DURATIONS = [1500, 450, 1700, 3000] as const
const PRESS_STEP = 1
const CREATED_STEP = 2
const PUBLISHED_STEP = 3
const ROW_HEIGHT = 40

const ROWS = [
  { key: 'fresh', member: 'ola', thumb: 'bg-primary/15 text-primary' },
  { key: 'recap', member: 'kuba', thumb: 'bg-amber-400/25 text-amber-700' },
  { draft: true, key: 'guide', member: 'marta', thumb: 'bg-muted' },
  { key: 'rules', member: 'ola', thumb: 'bg-emerald-500/20 text-emerald-700' },
] as const

const NAV: readonly {
  group: 'core' | 'group'
  items: readonly { active?: boolean; Icon: LucideIcon; key: string }[]
}[] = [
  {
    group: 'core',
    items: [
      { Icon: LayoutDashboard, key: 'dashboard' },
      { Icon: Users, key: 'users' },
    ],
  },
  {
    group: 'group',
    items: [
      { active: true, Icon: SquarePen, key: 'articles' },
      { Icon: List, key: 'categories' },
    ],
  },
]

const Status = ({ published }: { published: boolean }) => {
  const t = useTranslations('site.home.bento.content.admin')

  return (
    <span className="grid w-24 shrink-0 justify-items-start">
      <Badge
        className={cn(
          'col-start-1 row-start-1 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          published ? 'opacity-100' : 'scale-95 opacity-0',
        )}
      >
        <CircleCheck aria-hidden />
        {t('published')}
      </Badge>
      <Badge
        className={cn(
          'col-start-1 row-start-1 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          published ? 'scale-95 opacity-0' : 'opacity-100',
        )}
        variant="secondary"
      >
        <FilePen aria-hidden />
        {t('draft')}
      </Badge>
    </span>
  )
}

export const AdminTableScene = () => {
  const t = useTranslations('site.home.bento.content.admin')
  const { ref, step } = useLoopStep(DURATIONS)
  const created = step >= CREATED_STEP

  return (
    <div className="@container flex w-full justify-center self-start" ref={ref}>
      <div className="bg-card flex h-72 w-full max-w-190 overflow-hidden rounded-t-xl border border-b-0 mask-b-from-70% shadow-lg select-none">
        <div className="bg-muted/40 hidden w-40 shrink-0 flex-col gap-3 border-r p-3 @2xl:flex">
          <LogoVitNode className="w-20" idPrefix="bento-admin-logo" />
          {NAV.map(({ group, items }) => (
            <div className="flex flex-col gap-0.5" key={group}>
              <span className="text-muted-foreground px-2 pb-1 text-xs">
                {t(`nav.${group}`)}
              </span>
              {items.map(({ active, Icon, key }) => (
                <span
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs',
                    active && 'bg-card border-border font-medium shadow-xs',
                  )}
                  key={key}
                >
                  <Icon aria-hidden className="size-3.5 shrink-0" />
                  {t(`nav.${key}`)}
                </span>
              ))}
            </div>
          ))}
        </div>

        <div className="bg-background flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-semibold tracking-tight">
              {t('heading')}
            </span>
            <span
              className={cn(
                buttonVariants({ size: 'sm' }),
                'transition-transform duration-150 ease-out motion-reduce:transition-none',
                step === PRESS_STEP && 'scale-96',
              )}
            >
              <Plus aria-hidden />
              {t('create')}
            </span>
          </div>

          <div className="bg-card flex flex-col overflow-hidden rounded-xl border">
            <div className="flex items-center gap-2 border-b p-2">
              <span className="text-muted-foreground flex h-7 flex-1 items-center gap-2 rounded-md border px-2 text-xs">
                <Search aria-hidden className="size-3.5" />
                {t('search')}
              </span>
            </div>
            <div className="bg-muted/40 flex h-8 items-center gap-3 border-b px-3 text-xs font-medium">
              <span className="size-3.5 shrink-0 rounded-sm border" />
              <span className="min-w-0 flex-1">{t('columns.title')}</span>
              <span className="hidden w-20 shrink-0 @md:block">
                {t('columns.authors')}
              </span>
              <span className="w-24 shrink-0">{t('columns.status')}</span>
              <span className="hidden w-20 shrink-0 @md:block">
                {t('columns.updated')}
              </span>
              <span className="hidden w-10 shrink-0 @md:block" />
            </div>
            <div
              className="relative"
              style={{ height: ROWS.length * ROW_HEIGHT }}
            >
              {ROWS.map((row, index) => {
                const fresh = row.key === 'fresh'
                const shown = !fresh || created
                const slot = fresh
                  ? created
                    ? 0
                    : -0.5
                  : created
                    ? index
                    : index - 1
                const published = fresh
                  ? step >= PUBLISHED_STEP
                  : !('draft' in row)

                return (
                  <div
                    className={cn(
                      'absolute inset-x-0 top-0 flex h-10 items-center gap-3 border-b px-3 text-xs transition-[transform,opacity,background-color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                      shown ? 'opacity-100' : 'opacity-0',
                      fresh && step === CREATED_STEP
                        ? 'bg-primary/5'
                        : 'bg-transparent',
                    )}
                    key={row.key}
                    style={{
                      transform: `translateY(${slot * ROW_HEIGHT}px)`,
                    }}
                  >
                    <span className="size-3.5 shrink-0 rounded-sm border" />
                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span
                        className={cn(
                          'text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md',
                          row.thumb,
                        )}
                      >
                        <ImageIcon aria-hidden className="size-3" />
                      </span>
                      <span className="truncate font-medium">
                        {t(`rows.${row.key}.title`)}
                      </span>
                    </span>
                    <span className="hidden w-20 shrink-0 items-center gap-1.5 @md:flex">
                      <SceneAvatar
                        className={cn(
                          'size-5 text-xs',
                          MEMBER_TONE[row.member],
                        )}
                        initial={t(`rows.${row.key}.author`).charAt(0)}
                      />
                      <span className="truncate">
                        {t(`rows.${row.key}.author`)}
                      </span>
                    </span>
                    <Status published={published} />
                    <span className="text-muted-foreground hidden w-20 shrink-0 truncate @md:block">
                      {t(`rows.${row.key}.updated`)}
                    </span>
                    <span className="text-muted-foreground hidden w-10 shrink-0 items-center gap-2 @md:flex">
                      <Pencil aria-hidden className="size-3.5" />
                      <Ellipsis aria-hidden className="size-3.5" />
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
