import { Button } from '@vitnode/core/components/ui/button'
import { toast } from 'sonner'

const publishArticle = async (shouldFail: boolean) =>
  new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('Offline'))

        return
      }
      resolve()
    }, 2000)
  })

export default function ToastPromiseExample() {
  const run = (shouldFail: boolean) =>
    toast.promise(publishArticle(shouldFail), {
      loading: 'Publishing your article...',
      success: 'Article published',
      error: 'Could not publish the article',
    })

  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Button onClick={() => run(false)} variant="outline">
        Publish
      </Button>
      <Button onClick={() => run(true)} variant="outline">
        Publish (fails)
      </Button>
    </div>
  )
}
