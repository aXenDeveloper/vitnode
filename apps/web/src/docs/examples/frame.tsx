import { Badge } from '@vitnode/core/components/ui/badge'
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@vitnode/core/components/ui/frame'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@vitnode/core/components/ui/item'
import { Switch } from '@vitnode/core/components/ui/switch'
import { BotIcon, SparklesIcon } from 'lucide-react'

export default function FrameExample() {
  return (
    <Frame className="not-prose w-full">
      <FrameHeader>
        <FrameTitle render={<h3 />}>AI features</FrameTitle>
      </FrameHeader>
      <FramePanel>
        <Item>
          <ItemMedia aria-hidden variant="tile">
            <BotIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              Semantic search <Badge variant="outline">Smart</Badge>
            </ItemTitle>
            <ItemDescription>
              Find content by meaning, not exact wording.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch aria-label="Semantic search" defaultChecked />
          </ItemActions>
        </Item>
        <Item>
          <ItemMedia aria-hidden variant="tile">
            <SparklesIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              Insights <Badge variant="warning">Beta</Badge>
            </ItemTitle>
            <ItemDescription>
              Surface patterns and highlights from your community.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch aria-label="Insights" />
          </ItemActions>
        </Item>
      </FramePanel>
    </Frame>
  )
}
