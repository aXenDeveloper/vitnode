import { Button } from '@vitnode/core/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'
import { CloudUpload, Upload } from 'lucide-react'

export default function EmptyOutlineExample() {
  return (
    <Empty className="not-prose border p-6 md:p-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudUpload />
        </EmptyMedia>
        <EmptyTitle>No files uploaded</EmptyTitle>
        <EmptyDescription>
          This folder is emptier than a Monday morning inbox. Upload a file to
          share it with your team.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline">
          <Upload />
          Upload files
        </Button>
      </EmptyContent>
    </Empty>
  )
}
