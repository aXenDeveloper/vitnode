import { Button } from '@vitnode/core/components/ui/button'
import { Checkbox } from '@vitnode/core/components/ui/checkbox'
import { Label } from '@vitnode/core/components/ui/label'
import { cn } from 'cn'

const Lane = ({
  caption,
  label,
  withFeedback,
}: {
  caption: string
  label: string
  withFeedback: boolean
}) => {
  const frozen = !withFeedback && 'scale-100!'

  return (
    <figure className="bg-card flex flex-col items-center gap-4 rounded-lg border p-4">
      <figcaption className="text-muted-foreground font-mono text-xs">
        {label}
      </figcaption>
      <div className="flex flex-col items-center gap-4">
        <Button className={cn(frozen)}>Hold me</Button>
        <Label>
          <Checkbox className={cn(frozen)} defaultChecked />
          Remember me
        </Label>
      </div>
      <p className="text-muted-foreground text-center text-xs leading-relaxed text-pretty">
        {caption}
      </p>
    </figure>
  )
}

export default function MotionPress() {
  return (
    <div className="not-prose grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <Lane
        caption="Did that click register? Who knows."
        label="no feedback"
        withFeedback={false}
      />
      <Lane
        caption="Buttons dip to 97%, small controls to 90%."
        label="active:scale-97"
        withFeedback
      />
    </div>
  )
}
