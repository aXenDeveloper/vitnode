import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@vitnode/core/components/ui/attachment'
import { FileTextIcon } from 'lucide-react'

import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'
import adminRolesLight from '@/site/home/assets/admin-roles-light-800.webp'
import publicLoginLight from '@/site/home/assets/public-login-light-800.webp'

const SIZES = ['default', 'sm', 'xs'] as const

const GALLERY = [
  { name: 'dashboard.webp', src: adminDashboardLight },
  { name: 'roles-and-permissions.webp', src: adminRolesLight },
  { name: 'sign-in.webp', src: publicLoginLight },
  { name: 'dashboard-copy.webp', src: adminDashboardLight },
]

export default function AttachmentLayoutsExample() {
  return (
    <div className="not-prose flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {SIZES.map((size) => (
          <Attachment key={size} size={size}>
            <AttachmentMedia>
              <FileTextIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>size-{size}.pdf</AttachmentTitle>
            </AttachmentContent>
          </Attachment>
        ))}
      </div>

      <AttachmentGroup>
        {GALLERY.map((file) => (
          <Attachment key={file.name} orientation="vertical">
            <AttachmentTrigger
              aria-label={`Open ${file.name}`}
              render={<a href={file.src} rel="noreferrer" target="_blank" />}
            />
            <AttachmentMedia variant="image">
              <img alt="" src={file.src} />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{file.name}</AttachmentTitle>
              <AttachmentDescription>48 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ))}
      </AttachmentGroup>
    </div>
  )
}
