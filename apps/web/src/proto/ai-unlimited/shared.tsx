import { cn } from 'cn'
import { ChevronRightIcon, InfinityIcon } from 'lucide-react'

export const DetailsLink = ({ children = 'See your AI features' }: { children?: React.ReactNode }) => (
  <a
    className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
    href="/settings/ai"
  >
    {children}
    <ChevronRightIcon aria-hidden className="size-4 rtl:-scale-x-100" />
  </a>
)

export const InfinityTile = ({ className }: { className?: string }) => (
  <span
    aria-hidden
    className={cn('bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md', className)}
  >
    <InfinityIcon className="size-5" />
  </span>
)
