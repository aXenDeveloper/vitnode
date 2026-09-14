import {
  Error500Page,
  ErrorActions,
  NotFound,
} from '@vitnode/core/tanstack/layout'
import { DocsPage } from 'fumadocs-ui/layouts/notebook/page'

const DocsErrorFrame = ({ children }: { children: React.ReactNode }) => (
  <DocsPage
    breadcrumb={{ enabled: false }}
    className="items-center justify-center"
    footer={{ enabled: false }}
    tableOfContent={{ enabled: false }}
    tableOfContentPopover={{ enabled: false }}
  >
    {children}
  </DocsPage>
)

export const DocsNotFound = () => (
  <DocsErrorFrame>
    <NotFound actions={<ErrorActions />} />
  </DocsErrorFrame>
)

export const DocsError = () => (
  <DocsErrorFrame>
    <Error500Page actions={<ErrorActions />} />
  </DocsErrorFrame>
)
