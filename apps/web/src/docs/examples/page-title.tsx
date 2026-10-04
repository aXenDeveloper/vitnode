import { Button } from '@vitnode/core/components/ui/button'
import { PageTitle } from '@vitnode/core/components/ui/page-title'
import { PlusIcon } from 'lucide-react'

export default function PageTitleExample() {
  return (
    <PageTitle
      className="not-prose mb-0 w-full"
      desc="Group users and decide what each group can do."
      h2="Roles"
    >
      <Button>
        <PlusIcon />
        Create role
      </Button>
    </PageTitle>
  )
}
