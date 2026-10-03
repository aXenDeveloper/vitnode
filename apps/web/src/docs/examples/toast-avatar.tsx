import { Button } from '@vitnode/core/components/ui/button'
import { ToastAvatar, ToastMessage } from '@vitnode/core/components/ui/sonner'
import { toast } from 'sonner'

export default function ToastAvatarExample() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Button
        onClick={() =>
          toast('VitNode Team invited you', {
            description: 'Join the "Docs writers" group to start editing.',
            icon: (
              <ToastAvatar alt="VitNode Team" src="/logo_vitnode_icon.svg" />
            ),
            action: { label: 'Accept', onClick: () => {} },
          })
        }
        variant="outline"
      >
        Avatar
      </Button>
      <Button
        onClick={() =>
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
                description="Hey! I've finished the design review. Free to chat later?"
                time="2m ago"
                title="Alex Johnson"
              />
            ),
            { duration: 10000 },
          )
        }
        variant="outline"
      >
        Message
      </Button>
    </div>
  )
}
