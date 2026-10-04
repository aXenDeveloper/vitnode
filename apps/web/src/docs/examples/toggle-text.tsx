import { Toggle } from '@vitnode/core/components/ui/toggle'
import { BookmarkIcon, EyeOffIcon } from 'lucide-react'

export default function ToggleText() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Toggle size="sm" variant="outline">
        <BookmarkIcon data-icon="inline-start" />
        Bookmark
      </Toggle>
      <Toggle defaultPressed size="sm" variant="outline">
        <EyeOffIcon data-icon="inline-start" />
        Hide spoilers
      </Toggle>
    </div>
  )
}
