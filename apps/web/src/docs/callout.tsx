import type React from 'react'

import {
  Alert,
  AlertDescription,
  AlertTitle,
  type AlertVariant,
} from '@vitnode/core/components/ui/alert'
import { cn } from 'cn'
import { LightbulbIcon } from 'lucide-react'

const CALLOUT_VARIANTS = {
  error: 'destructive',
  idea: 'info',
  info: 'info',
  success: 'success',
  warn: 'warning',
  warning: 'warning',
} as const satisfies Record<string, AlertVariant>

export const Callout = ({
  children,
  className,
  icon,
  title,
  type = 'info',
  ...props
}: Omit<React.ComponentProps<typeof Alert>, 'title' | 'variant'> & {
  title?: React.ReactNode
  type?: keyof typeof CALLOUT_VARIANTS
}) => (
  <Alert
    className={cn('my-4', className)}
    icon={icon ?? (type === 'idea' ? <LightbulbIcon /> : undefined)}
    role="note"
    variant={CALLOUT_VARIANTS[type]}
    {...props}
  >
    {title ? <AlertTitle className="my-0">{title}</AlertTitle> : null}
    <AlertDescription className="prose-no-margin">{children}</AlertDescription>
  </Alert>
)
