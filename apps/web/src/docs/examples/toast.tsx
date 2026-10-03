import { Button } from '@vitnode/core/components/ui/button'
import { toast } from 'sonner'

const demos = [
  {
    label: 'Default',
    show: () =>
      toast('Thread moved', {
        description: 'Now living in General discussion.',
      }),
  },
  {
    label: 'Info',
    show: () =>
      toast.info('Maintenance tonight', {
        description: 'The forum is read-only from 2:00 to 2:30 AM.',
      }),
  },
  {
    label: 'Success',
    show: () =>
      toast.success('Post published', {
        description: 'Your reply is live in "Login fails after reset".',
      }),
  },
  {
    label: 'Warning',
    show: () =>
      toast.warning('Running low on storage', {
        description: 'Only 200 MB left. Time for some spring cleaning?',
      }),
  },
  {
    label: 'Error',
    show: () =>
      toast.error('Could not save the post', {
        description: 'You seem to be offline. Your draft is safe.',
      }),
  },
]

export default function ToastExample() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      {demos.map(({ label, show }) => (
        <Button key={label} onClick={show} variant="outline">
          {label}
        </Button>
      ))}
    </div>
  )
}
