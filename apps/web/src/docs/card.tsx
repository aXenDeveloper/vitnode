import type React from 'react'

import { cn } from 'cn'
import { Card as FumadocsCard } from 'fumadocs-ui/components/card'

export const Card = ({
  className,
  href,
  icon,
  ...props
}: React.ComponentProps<typeof FumadocsCard>) => (
  <FumadocsCard
    className={cn(href && 'hover:border-fd-primary/60', className)}
    href={href}
    icon={icon ? <span className="text-fd-primary flex">{icon}</span> : null}
    {...props}
  />
)
