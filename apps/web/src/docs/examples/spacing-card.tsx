import { Button } from '@vitnode/core/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import React from 'react'

const SpacingCard = ({ size }: { size: 'default' | 'sm' }) => {
  const [padding, setPadding] = React.useState('…')

  const cardRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) setPadding(getComputedStyle(node).paddingTop)
  }, [])

  return (
    <Card ref={cardRef} size={size}>
      <CardHeader>
        <CardTitle>size=&quot;{size}&quot;</CardTitle>
        <CardDescription>
          --card-spacing:{' '}
          <span className="text-foreground font-mono tabular-nums">
            {padding}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed">
          Header, content and footer share one value.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline">
          Open
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function SpacingCardDemo() {
  return (
    <div className="not-prose grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2">
      <SpacingCard size="default" />
      <SpacingCard size="sm" />
    </div>
  )
}
