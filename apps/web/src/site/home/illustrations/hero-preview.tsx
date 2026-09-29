import { cn } from 'cn'
import { FileCode2, Sparkles } from 'lucide-react'
import { useTranslations } from 'use-intl'

import { ScreenFrame } from '@/site/marketing/screen-frame'
import { SCREENS } from '@/site/marketing/screens'

const MEMBERS = ['MA', 'KW', 'OL']
const MEMBER_COUNT = 1285

const depthStyle = (depth: number) =>
  ({ '--depth': `${depth}` }) as React.CSSProperties

const Floating = ({
  children,
  className,
  delay,
  depth,
}: {
  children: React.ReactNode
  className?: string
  delay: number
  depth: number
}) => (
  <div
    className={cn('mk-parallax absolute', className)}
    style={depthStyle(depth)}
  >
    <div className="mk-enter-pop" style={{ animationDelay: `${delay}ms` }}>
      <div
        className="mk-anim-float"
        style={{
          animationDelay: `-${delay * 4}ms`,
          animationDuration: `${5 + (depth % 4)}s`,
        }}
      >
        {children}
      </div>
    </div>
  </div>
)

const ToastCard = () => {
  const t = useTranslations('site.home.hero.preview')

  return (
    <div className="bg-popover text-popover-foreground flex w-max max-w-72 items-center gap-3 rounded-2xl border p-3 shadow-2xl">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
        <Sparkles className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-sm font-semibold">
          {t('toast_title', { name: 'Maya' })}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {t('toast_meta')}
        </p>
      </div>
    </div>
  )
}

const ConfigCard = () => (
  <div className="bg-card text-card-foreground w-52 rounded-2xl border p-3 font-mono text-xs leading-relaxed shadow-2xl">
    <p className="text-muted-foreground flex items-center gap-1.5">
      <FileCode2 className="size-3.5 shrink-0" />
      vitnode.config.ts
    </p>
    <p>
      plugins<span className="text-muted-foreground">: [</span>
    </p>
    <p className="pl-4">
      blogPlugin<span className="text-muted-foreground">(),</span>
    </p>
    <p className="bg-primary/10 text-primary -mx-1 rounded px-1 pl-5 font-medium">
      eventsPlugin<span className="text-primary/60">(),</span>
    </p>
    <p className="text-muted-foreground">]</p>
  </div>
)

const MembersCard = () => {
  const t = useTranslations('site.home.hero.preview')

  return (
    <div className="bg-card flex items-center gap-3 rounded-2xl border p-3 shadow-2xl">
      <div className="flex">
        {MEMBERS.map((initials, index) => (
          <span
            className={cn(
              'ring-card flex size-8 items-center justify-center rounded-full text-xs font-semibold ring-2',
              index === 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground -ml-1.5',
            )}
            key={initials}
          >
            {initials}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
        {t.rich('members', {
          count: MEMBER_COUNT,
          strong: (chunks) => (
            <strong className="text-foreground font-semibold">{chunks}</strong>
          ),
        })}
      </p>
    </div>
  )
}

export const HeroPreview = ({ ref }: { ref?: React.Ref<HTMLDivElement> }) => {
  const t = useTranslations('site.home.hero.preview')

  return (
    <div className="relative min-w-0" ref={ref}>
      <div
        className="mk-enter-fade w-160 sm:w-200 lg:w-240"
        style={{ animationDelay: '120ms' }}
      >
        <div
          style={{
            maskImage: 'linear-gradient(to bottom, black 58%, transparent 98%)',
            transform:
              'perspective(1800px) rotateY(-20deg) rotateX(8deg) rotateZ(1deg)',
            transformOrigin: 'left center',
          }}
        >
          <ScreenFrame
            priority
            screen={{ ...SCREENS.dashboard, alt: t('alt') }}
          />
        </div>
      </div>

      <div aria-hidden className="pointer-events-none select-none">
        <Floating
          className="top-16 left-2 sm:top-20 lg:-left-10"
          delay={500}
          depth={26}
        >
          <ToastCard />
        </Floating>
        <Floating
          className="bottom-16 left-6 max-sm:hidden lg:-left-16"
          delay={650}
          depth={16}
        >
          <ConfigCard />
        </Floating>
        <Floating
          className="right-4 bottom-6 max-sm:hidden lg:right-auto lg:left-64"
          delay={800}
          depth={22}
        >
          <MembersCard />
        </Floating>
      </div>
    </div>
  )
}
