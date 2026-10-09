import { buttonVariants } from '@vitnode/core/components/ui/button'
import { Input } from '@vitnode/core/components/ui/input'
import { Table } from '@vitnode/core/components/ui/table'
import { cn } from 'cn'
import { ChevronDown, Search } from 'lucide-react'
import { useTranslations } from 'use-intl'

export const StaticButton = ({
  children,
  className,
  size = 'sm',
  variant = 'outline',
}: {
  children: React.ReactNode
  className?: string
  size?: 'default' | 'sm' | 'xs'
  variant?: 'default' | 'ghost' | 'outline'
}) => (
  <span className={cn(buttonVariants({ size, variant }), className)}>
    {children}
  </span>
)

export const Field = ({
  children,
  label,
  optional = false,
}: {
  children: React.ReactNode
  label: string
  optional?: boolean
}) => {
  const t = useTranslations('site.home.hero.wall.common')

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {label}
        {optional && (
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            {t('optional')}
          </span>
        )}
      </span>
      {children}
    </div>
  )
}

export const LanguageInput = ({ value }: { value: string }) => {
  const t = useTranslations('site.home.hero.wall.common')

  return (
    <div className="relative">
      <Input className="pr-24" readOnly value={value} />
      <span className="text-muted-foreground absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 text-xs">
        {t('english')}
        <ChevronDown className="size-3.5" />
      </span>
    </div>
  )
}

export const SearchField = ({ placeholder }: { placeholder: string }) => (
  <div className="relative">
    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
    <Input className="pl-9" placeholder={placeholder} readOnly />
  </div>
)

export const TableCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card overflow-hidden rounded-lg border">
    <Table>{children}</Table>
  </div>
)

export const Initials = ({
  className,
  initials,
}: {
  className: string
  initials: string
}) => (
  <span
    className={cn(
      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
      className,
    )}
  >
    {initials}
  </span>
)

export const Meter = ({ value }: { value: number }) => (
  <span className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
    <span
      className="bg-primary h-full rounded-full"
      style={{ width: `${value}%` }}
    />
  </span>
)

export const ToggleLook = ({ on }: { on: boolean }) => (
  <span
    className={cn(
      'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5',
      on ? 'bg-primary' : 'bg-input',
    )}
  >
    <span
      className={cn(
        'bg-background size-4 rounded-full shadow-sm',
        on && 'translate-x-4',
      )}
    />
  </span>
)

export const ListRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
    {children}
  </div>
)

export const utcDate = (iso: string) => new Date(`${iso}T12:00:00Z`)
