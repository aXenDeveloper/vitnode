import { Avatar, AvatarFallback } from '@vitnode/core/components/ui/avatar'
import { Button } from '@vitnode/core/components/ui/button'
import { Card, CardContent, CardHeader } from '@vitnode/core/components/ui/card'
import { Skeleton } from '@vitnode/core/components/ui/skeleton'
import React from 'react'

const ThreadSkeleton = () => (
  <Card className="w-full">
    <CardHeader className="flex items-center gap-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </CardContent>
  </Card>
)

const Thread = () => (
  <Card className="w-full">
    <CardHeader className="flex items-center gap-3">
      <Avatar size="lg">
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <p className="font-medium">Ada Lovelace</p>
        <p className="text-muted-foreground text-xs">Posted 5 minutes ago</p>
      </div>
    </CardHeader>
    <CardContent>
      <p className="leading-relaxed">
        Is there a way to schedule a post for next Monday? Asking for a very
        punctual friend.
      </p>
    </CardContent>
  </Card>
)

export default function SkeletonCardExample() {
  const [isLoading, setIsLoading] = React.useState(true)

  return (
    <div className="not-prose flex w-full max-w-sm flex-col items-center gap-4">
      <div aria-busy={isLoading} aria-live="polite" className="w-full">
        {isLoading ? <ThreadSkeleton /> : <Thread />}
      </div>
      <Button
        onClick={() => setIsLoading((value) => !value)}
        size="sm"
        variant="outline"
      >
        {isLoading ? 'Finish loading' : 'Load again'}
      </Button>
    </div>
  )
}
