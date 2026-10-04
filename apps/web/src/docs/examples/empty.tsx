import { Button } from '@vitnode/core/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'
import { ArrowUpRight, FolderCode } from 'lucide-react'

export default function EmptyExample() {
  return (
    <Empty className="not-prose p-6 md:p-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderCode />
        </EmptyMedia>
        <EmptyTitle>No projects yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any projects yet. Start a fresh one or import
          an existing repository.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button>Create project</Button>
          <Button variant="outline">Import project</Button>
        </div>
      </EmptyContent>
      <Button size="sm" variant="link">
        Learn more
        <ArrowUpRight />
      </Button>
    </Empty>
  )
}
