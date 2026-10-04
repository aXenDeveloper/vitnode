import { Button } from '@vitnode/core/components/ui/button'
import { toast } from 'sonner'

export default function ToastActionExample() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Button
        onClick={() =>
          toast('Thread archived', {
            description: 'It no longer shows up in the feed.',
            action: {
              label: 'Undo',
              onClick: () => toast.success('Thread restored'),
            },
          })
        }
        variant="outline"
      >
        Action
      </Button>
      <Button
        onClick={() =>
          toast.warning('New version available', {
            description: 'Reload to get the latest fixes.',
            action: { label: 'Reload', onClick: () => {} },
            cancel: { label: 'Later', onClick: () => {} },
          })
        }
        variant="outline"
      >
        Action + cancel
      </Button>
    </div>
  )
}
