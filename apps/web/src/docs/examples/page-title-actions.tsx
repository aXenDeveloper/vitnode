import { Button } from '@vitnode/core/components/ui/button'
import { PageTitle } from '@vitnode/core/components/ui/page-title'
import { DownloadIcon, PlusIcon } from 'lucide-react'

export default function PageTitleActionsExample() {
  return (
    <PageTitle
      className="not-prose mb-0 w-full"
      desc="Everything published on the site, newest first."
      h2="Blog posts"
    >
      <Button variant="outline">
        <DownloadIcon />
        Export
      </Button>
      <Button>
        <PlusIcon />
        New post
      </Button>
    </PageTitle>
  )
}
