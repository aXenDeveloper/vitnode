import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@vitnode/core/components/ui/attachment'
import {
  FileTextIcon,
  ImageIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'

import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'

export default function AttachmentStatesExample() {
  return (
    <div className="not-prose flex w-full flex-col gap-3">
      <Attachment state="idle">
        <AttachmentMedia>
          <UploadIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>Drop a cover image</AttachmentTitle>
          <AttachmentDescription>idle</AttachmentDescription>
        </AttachmentContent>
      </Attachment>

      <Attachment state="uploading">
        <AttachmentMedia variant="image">
          <img alt="" src={adminDashboardLight} />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>community-banner.webp</AttachmentTitle>
          <AttachmentDescription>uploading · 64%</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Cancel community-banner.webp">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>

      <Attachment state="processing">
        <AttachmentMedia>
          <ImageIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>event-photos.zip</AttachmentTitle>
          <AttachmentDescription>
            processing · making thumbnails
          </AttachmentDescription>
        </AttachmentContent>
      </Attachment>

      <Attachment state="done">
        <AttachmentMedia>
          <FileTextIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>forum-rules-2026.pdf</AttachmentTitle>
          <AttachmentDescription>done · 1.2 MB</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Remove forum-rules-2026.pdf">
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>

      <Attachment state="error">
        <AttachmentMedia>
          <TriangleAlertIcon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>meetup-recording.mov</AttachmentTitle>
          <AttachmentDescription>
            2 GB is over the 50 MB limit.
          </AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction aria-label="Retry meetup-recording.mov">
            <RotateCcwIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
  )
}
