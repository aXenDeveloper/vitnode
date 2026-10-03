import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@vitnode/core/components/ui/alert'
import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'

export default function ColorsStatus() {
  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">Published</Badge>
        <Badge variant="warning">Scheduled</Badge>
        <Badge variant="destructive">Rejected</Badge>
        <Badge>New</Badge>
      </div>
      <Alert variant="success">
        <AlertTitle>Changes saved</AlertTitle>
        <AlertDescription>Your profile is up to date.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Storage almost full</AlertTitle>
        <AlertDescription>92% of 10 GB used.</AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button>Publish</Button>
        <Button variant="destructive">Delete post</Button>
      </div>
    </div>
  )
}
