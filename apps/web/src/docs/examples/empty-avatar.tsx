import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vitnode/core/components/ui/avatar'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'

export default function EmptyAvatarExample() {
  return (
    <Empty className="not-prose p-6 md:p-12">
      <EmptyHeader>
        <EmptyMedia>
          <Avatar size="lg">
            <AvatarImage alt="" src="/logo_vitnode_icon.svg" />
            <AvatarFallback>VN</AvatarFallback>
          </Avatar>
        </EmptyMedia>
        <EmptyTitle>Ada is offline</EmptyTitle>
        <EmptyDescription>
          She&apos;ll see your message the next time she signs in. Leave a note
          and she can pick it up from there.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Leave a message</Button>
      </EmptyContent>
    </Empty>
  )
}
