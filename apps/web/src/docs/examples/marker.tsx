import { Bubble, BubbleContent } from '@vitnode/core/components/ui/bubble'
import { Card } from '@vitnode/core/components/ui/card'
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from '@vitnode/core/components/ui/marker'
import { Spinner } from '@vitnode/core/components/ui/spinner'
import { FileText, GitBranch, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function MarkerExample() {
  return (
    <Card
      aria-label="Chat with the VitNode assistant"
      className="not-prose flex w-full flex-col gap-6 px-4 py-8 sm:px-6"
      role="log"
    >
      <Marker variant="separator">
        <MarkerContent>Today</MarkerContent>
      </Marker>

      <Bubble align="end">
        <BubbleContent>Can you clean up the stale routes?</BubbleContent>
      </Bubble>

      <Marker>
        <MarkerIcon>
          <GitBranch />
        </MarkerIcon>
        <MarkerContent>Switched to chore/stale-routes</MarkerContent>
      </Marker>

      <div className="flex flex-col gap-3">
        <Marker variant="border">
          <MarkerIcon>
            <Search />
          </MarkerIcon>
          <MarkerContent>Explored 4 files</MarkerContent>
        </Marker>
        <Marker variant="border">
          <MarkerIcon>
            <FileText />
          </MarkerIcon>
          <MarkerContent>Opened routeTree.gen.ts</MarkerContent>
        </Marker>
      </div>

      <Bubble variant="muted">
        <BubbleContent>
          Done - two routes were older than my coffee. Both are gone.
        </BubbleContent>
      </Bubble>

      <Marker
        render={
          <button
            className="hover:text-foreground transition-colors"
            onClick={() => {
              toast('Change reverted', {
                description: 'The stale routes are back. Sorry, coffee.',
              })
            }}
            type="button"
          />
        }
      >
        <MarkerIcon>
          <RotateCcw />
        </MarkerIcon>
        <MarkerContent>Revert this change</MarkerContent>
      </Marker>

      <Marker variant="separator">
        <MarkerContent>Conversation compacted</MarkerContent>
      </Marker>

      <Marker role="status">
        <MarkerIcon>
          <Spinner />
        </MarkerIcon>
        <MarkerContent className="shimmer">Thinking...</MarkerContent>
      </Marker>
    </Card>
  )
}
