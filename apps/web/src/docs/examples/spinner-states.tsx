import { Card } from '@vitnode/core/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'
import { Spinner } from '@vitnode/core/components/ui/spinner'

export default function SpinnerStatesExample() {
  return (
    <div className="not-prose grid w-full gap-4 sm:grid-cols-2">
      <Empty className="rounded-lg border p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Loading your files</EmptyTitle>
          <EmptyDescription>
            This usually takes a second or two.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <Card aria-busy="true" className="relative gap-2 overflow-hidden p-6">
        <p className="font-medium">Monthly revenue</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Crunching this month&apos;s numbers...
        </p>
        <div className="bg-background/70 absolute inset-0 flex items-center justify-center backdrop-blur-xs">
          <Spinner className="text-primary" size="lg" />
        </div>
      </Card>
    </div>
  )
}
