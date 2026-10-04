import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@vitnode/core/components/ui/attachment'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vitnode/core/components/ui/avatar'
import {
  Bubble,
  BubbleContent,
  BubbleReactions,
} from '@vitnode/core/components/ui/bubble'
import { Button } from '@vitnode/core/components/ui/button'
import { Card } from '@vitnode/core/components/ui/card'
import { Marker, MarkerContent } from '@vitnode/core/components/ui/marker'
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from '@vitnode/core/components/ui/message'
import { Copy, FileText, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'

export default function MessageExample() {
  return (
    <Card
      aria-label="Team chat"
      className="not-prose flex w-full flex-col gap-6 px-4 py-8 sm:px-6"
      role="log"
    >
      <Marker variant="separator">
        <MarkerContent>Today</MarkerContent>
      </Marker>

      <MessageGroup>
        <Message>
          <MessageAvatar />
          <MessageContent>
            <MessageHeader className="gap-1.5">
              <span className="text-foreground">Ava</span>
              <time dateTime="2026-10-02T09:41">9:41 AM</time>
            </MessageHeader>
            <Bubble variant="muted">
              <BubbleContent>Morning! Did the plugin build pass?</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
        <Message>
          <MessageAvatar aria-hidden="true">
            <Avatar>
              <AvatarFallback>AV</AvatarFallback>
            </Avatar>
          </MessageAvatar>
          <MessageContent>
            <Bubble variant="muted">
              <BubbleContent>
                Asking for a friend. The friend is me.
              </BubbleContent>
              <BubbleReactions aria-label="Reactions: eyes" role="img">
                <span>👀</span>
              </BubbleReactions>
            </Bubble>
          </MessageContent>
        </Message>
      </MessageGroup>

      <Message align="end">
        <MessageContent>
          <MessageHeader className="sr-only">You</MessageHeader>
          <Attachment>
            <AttachmentMedia>
              <FileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>build-log.txt</AttachmentTitle>
              <AttachmentDescription>TXT · 12 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
          <Bubble>
            <BubbleContent>Green across the board. Log attached.</BubbleContent>
          </Bubble>
          <MessageFooter className="gap-1">
            Read <time dateTime="2026-10-02T09:43">9:43 AM</time>
          </MessageFooter>
        </MessageContent>
      </Message>

      <Message>
        <MessageAvatar>
          <Avatar>
            <AvatarImage alt="VitNode assistant" src="/logo_vitnode_icon.svg" />
            <AvatarFallback>VN</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <Bubble variant="secondary">
            <BubbleContent>
              Congrats! Want me to publish it to the marketplace?
            </BubbleContent>
          </Bubble>
          <MessageFooter>
            <Button
              aria-label="Copy message"
              onClick={() =>
                toast('Message copied', {
                  description: 'Pretend it is on your clipboard now.',
                })
              }
              size="icon-xs"
              title="Copy message"
              variant="ghost"
            >
              <Copy />
            </Button>
            <Button
              aria-label="Good response"
              onClick={() =>
                toast('Thanks for the feedback', {
                  description: 'The assistant is blushing.',
                })
              }
              size="icon-xs"
              title="Good response"
              variant="ghost"
            >
              <ThumbsUp />
            </Button>
          </MessageFooter>
        </MessageContent>
      </Message>

      <Marker role="status">
        <MarkerContent className="shimmer">
          <span className="font-medium">Ava</span> is typing...
        </MarkerContent>
      </Marker>
    </Card>
  )
}
