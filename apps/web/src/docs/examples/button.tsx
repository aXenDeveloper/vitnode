import { Button } from '@vitnode/core/components/ui/button'
import {
  ArrowRightIcon,
  CircleCheckIcon,
  EyeIcon,
  PencilIcon,
  ReplyIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'

export default function ButtonExample() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Button>
        <SendIcon />
        Post reply
      </Button>
      <Button variant="secondary">
        <PencilIcon />
        Edit
      </Button>
      <Button variant="outline">
        <EyeIcon />
        Preview
      </Button>
      <Button variant="ghost">
        <ReplyIcon />
        Quote
      </Button>
      <Button variant="link">
        View thread
        <ArrowRightIcon />
      </Button>
      <Button variant="success">
        <CircleCheckIcon />
        Approve
      </Button>
      <Button variant="warning">
        <TriangleAlertIcon />
        Unpublish
      </Button>
      <Button variant="destructive">
        <Trash2Icon />
        Delete
      </Button>
    </div>
  )
}
