import { Button } from '@vitnode/core/components/ui/button'
import { SaveIcon } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

export default function ButtonLoading() {
  const [isLoading, setIsLoading] = React.useState(false)

  const save = () => {
    setIsLoading(true)
    window.setTimeout(() => {
      setIsLoading(false)
      toast.success('Settings saved', {
        description: 'Your forum settings are live.',
      })
    }, 1500)
  }

  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Button isLoading={isLoading} onClick={save}>
        <SaveIcon />
        Save changes
      </Button>
      <Button isLoading variant="outline">
        Always loading
      </Button>
    </div>
  )
}
