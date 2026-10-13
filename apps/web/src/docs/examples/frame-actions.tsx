import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Frame,
  FrameAction,
  FrameDescription,
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
import { FileTextIcon, GlobeIcon, LinkIcon } from 'lucide-react'

export default function FrameActionsExample() {
  return (
    <Frame className="not-prose w-full">
      <FrameHeader>
        <FrameTitle render={<h3 />}>Publishing</FrameTitle>
        <FrameDescription>Where visitors find your site.</FrameDescription>
        <FrameAction>
          <Button size="sm" variant="ghost">
            Learn more
          </Button>
        </FrameAction>
      </FrameHeader>
      <FramePanel render={<ul />}>
        <Item render={<li />}>
          <ItemMedia aria-hidden variant="tile">
            <GlobeIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              Subdomain <Badge variant="outline">Fallback</Badge>
            </ItemTitle>
            <ItemDescription>
              The address visitors use before you add a custom domain.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </ItemActions>
        </Item>
        <Item render={<li />}>
          <ItemMedia aria-hidden variant="tile">
            <LinkIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              Custom domain <Badge variant="success">HTTPS</Badge>
            </ItemTitle>
            <ItemDescription>
              Bring your own address and serve it over HTTPS.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              Connect
            </Button>
          </ItemActions>
        </Item>
        <Item render={<li />}>
          <ItemMedia aria-hidden variant="tile">
            <FileTextIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              Default page <Badge variant="warning">Homepage</Badge>
            </ItemTitle>
            <ItemDescription>
              What new visitors see when they land on your site.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              Change
            </Button>
          </ItemActions>
        </Item>
      </FramePanel>
    </Frame>
  )
}
