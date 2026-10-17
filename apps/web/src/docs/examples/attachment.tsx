import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@vitnode/core/components/ui/attachment'
import { XIcon } from 'lucide-react'

import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'

export default function AttachmentExample() {
  return (
    <div className="not-prose flex w-full justify-center">
      <Attachment>
        <AttachmentMedia variant="image">
          <img
            alt=""
            decoding="async"
            height={433}
            loading="lazy"
            src={adminDashboardLight}
            width={800}
          />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>dashboard-screenshot.webp</AttachmentTitle>
          <AttachmentDescription>48 KB</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Remove dashboard-screenshot.webp">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
  )
}
