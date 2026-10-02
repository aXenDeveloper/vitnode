import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@vitnode/core/components/ui/attachment'
import { Spinner } from '@vitnode/core/components/ui/spinner'
import {
  FileTextIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'

import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'

export default function AttachmentExample() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Attachment>
          <AttachmentMedia variant="image">
            <img alt="" src={adminDashboardLight} />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>dashboard.webp</AttachmentTitle>
            <AttachmentDescription>48 KB</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Remove dashboard.webp">
              <XIcon />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>

        <Attachment state="uploading">
          <AttachmentMedia>
            <FileTextIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>release-notes.pdf</AttachmentTitle>
            <AttachmentDescription>Uploading... · 1.2 MB</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <Spinner aria-label="Uploading" className="mx-1.5" />
          </AttachmentActions>
        </Attachment>

        <Attachment state="error">
          <AttachmentMedia>
            <TriangleAlertIcon />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>holiday-video.mov</AttachmentTitle>
            <AttachmentDescription>
              That file is 2 GB. The maximum is 50 MB.
            </AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="Retry holiday-video.mov">
              <RotateCcwIcon />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      </div>

      <AttachmentGroup>
        {['cover.webp', 'gallery-1.webp', 'gallery-2.webp'].map((name) => (
          <Attachment key={name} orientation="vertical">
            <AttachmentMedia variant="image">
              <img alt="" src={adminDashboardLight} />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{name}</AttachmentTitle>
              <AttachmentDescription>48 KB</AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        ))}
      </AttachmentGroup>
    </div>
  )
}
