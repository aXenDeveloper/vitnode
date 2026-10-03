import { Button } from '@vitnode/core/components/ui/button'
import { Checkbox } from '@vitnode/core/components/ui/checkbox'
import { Input } from '@vitnode/core/components/ui/input'
import { Kbd } from '@vitnode/core/components/ui/kbd'
import { Label } from '@vitnode/core/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vitnode/core/components/ui/select'
import { Switch } from '@vitnode/core/components/ui/switch'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import React from 'react'

const SORT_ITEMS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Most liked', value: 'liked' },
]

interface FocusState {
  control: string
  isRingVisible: boolean
}

export default function AccessibilityFocus() {
  const id = React.useId()
  const [focus, setFocus] = React.useState<FocusState | null>(null)

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const control = event.target.closest<HTMLElement>('[data-demo-control]')
    if (!control?.dataset.demoControl) return

    setFocus({
      control: control.dataset.demoControl,
      isRingVisible: event.target.matches(':focus-visible'),
    })
  }

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Press <Kbd>Tab</Kbd> to walk through the controls, then click one with
        your mouse.
      </p>

      <div
        className="bg-card flex flex-col gap-4 rounded-lg border p-4"
        onFocus={handleFocus}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1" data-demo-control="Input">
            <Input
              aria-label="Search posts"
              placeholder="Search posts…"
              type="search"
            />
          </div>
          <div data-demo-control="Select">
            <Select defaultValue="newest" items={SORT_ITEMS}>
              <SelectTrigger aria-label="Sort posts" className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex items-center gap-2"
              data-demo-control="Checkbox"
            >
              <Checkbox defaultChecked id={`${id}-pinned`} />
              <Label htmlFor={`${id}-pinned`}>Pinned only</Label>
            </div>
            <div className="flex items-center gap-2" data-demo-control="Switch">
              <Switch id={`${id}-compact`} />
              <Label htmlFor={`${id}-compact`}>Compact</Label>
            </div>
          </div>
          <div data-demo-control="Button">
            <Button variant="outline">Apply</Button>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground flex min-h-5 items-center gap-2 text-sm">
        {focus === null ? (
          'Nothing focused yet.'
        ) : (
          <>
            {focus.isRingVisible ? (
              <EyeIcon aria-hidden className="text-primary size-4" />
            ) : (
              <EyeOffIcon aria-hidden className="size-4" />
            )}
            <span>
              <span className="text-foreground font-medium">
                {focus.control}
              </span>{' '}
              {focus.isRingVisible
                ? 'focused, ring visible.'
                : 'focused, ring hidden.'}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
