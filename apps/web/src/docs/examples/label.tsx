import { Checkbox } from '@vitnode/core/components/ui/checkbox'
import { Input } from '@vitnode/core/components/ui/input'
import { Label } from '@vitnode/core/components/ui/label'

export default function LabelExample() {
  return (
    <div className="not-prose flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-center gap-3">
        <Checkbox id="label-demo-terms" />
        <Label htmlFor="label-demo-terms">I promise I read the terms</Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="label-demo-email">Email</Label>
        <Input
          autoComplete="email"
          id="label-demo-email"
          placeholder="you@example.com"
          type="email"
        />
      </div>

      <div className="flex items-center gap-3">
        <Checkbox disabled id="label-demo-newsletter" />
        <Label htmlFor="label-demo-newsletter">
          Weekly newsletter (coming soon)
        </Label>
      </div>
    </div>
  )
}
