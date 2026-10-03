import { Button } from '@vitnode/core/components/ui/button'
import { ToastAvatar, ToastMessage } from '@vitnode/core/components/ui/sonner'
import { toast } from 'sonner'

const wait = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const demos = [
  {
    label: 'Default',
    show: () =>
      toast('Event has been created', {
        description: 'Sunday, December 03, 2023 at 9:00 AM',
        action: { label: 'Undo', onClick: () => {} },
      }),
  },
  {
    label: 'Info',
    show: () =>
      toast.info('You have 2 credits left', {
        description: 'Get a paid plan for more credits.',
        action: { label: 'Upgrade', onClick: () => {} },
      }),
  },
  {
    label: 'Success',
    show: () =>
      toast.success('Your plan has been upgraded', {
        description: 'Enjoy the extra credits - you earned them.',
      }),
  },
  {
    label: 'Warning',
    show: () =>
      toast.warning('You are running low on storage', {
        description: 'Only 200 MB left. Time for some spring cleaning?',
        action: { label: 'Manage', onClick: () => {} },
      }),
  },
  {
    label: 'Error',
    show: () =>
      toast.error('Storage is full', {
        description: 'Remove some files to free up space.',
        action: { label: 'Remove', onClick: () => {} },
      }),
  },
  {
    label: 'Avatar',
    show: () =>
      toast('VitNode Team invited you', {
        description: 'Join the "Docs writers" group to start editing.',
        icon: <ToastAvatar alt="VitNode Team" src="/logo_vitnode_icon.svg" />,
        action: { label: 'Accept', onClick: () => {} },
      }),
  },
  {
    label: 'Message',
    show: () =>
      toast.custom(
        (id) => (
          <ToastMessage
            actions={[
              {
                label: 'Dismiss',
                onClick: () => toast.dismiss(id),
                variant: 'outline',
              },
              {
                label: 'Reply',
                onClick: () => {
                  toast.dismiss(id)
                  toast.success('Reply sent', {
                    description: 'Alex will see it next time they look.',
                  })
                },
              },
            ]}
            avatar={{ alt: 'Alex Johnson', fallback: 'AJ' }}
            description="Hey! I've finished the design review. Let me know when you're free to discuss."
            time="2m ago"
            title="Alex Johnson"
          />
        ),
        { duration: 10000 },
      ),
  },
  {
    label: 'Promise',
    show: () =>
      toast.promise(wait(2000), {
        loading: 'Publishing your article...',
        success: 'Article published',
        error: 'Could not publish the article',
      }),
  },
]

export default function ToastExample() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {demos.map(({ label, show }) => (
        <Button key={label} onClick={show} variant="outline">
          {label}
        </Button>
      ))}
    </div>
  )
}
