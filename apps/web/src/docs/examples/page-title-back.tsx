import { Button } from '@vitnode/core/components/ui/button'
import { PageTitle } from '@vitnode/core/components/ui/page-title'

export default function PageTitleBackExample() {
  return (
    <PageTitle
      back={{ href: '/docs/ui', label: 'Back to UI' }}
      className="not-prose mb-0 w-full"
      desc="Edit the details shown on the public profile."
      h2="Edit user"
    >
      <Button>Save changes</Button>
    </PageTitle>
  )
}
