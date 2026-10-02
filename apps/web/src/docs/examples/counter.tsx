import { Card } from '@vitnode/core/components/ui/card'
import { Counter } from '@vitnode/core/components/ui/counter'
import React from 'react'

export default function CounterExample() {
  const [quantity, setQuantity] = React.useState(1)

  return (
    <Card className="not-prose flex w-full flex-row items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium" id="counter-ticket-label">
          Conference ticket
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Up to 10 per order
        </p>
      </div>
      <Counter
        aria-labelledby="counter-ticket-label"
        max={10}
        min={1}
        onValueChange={setQuantity}
        value={quantity}
      />
    </Card>
  )
}
