import type { AutoFormFileValue } from '@vitnode/core/components/form/fields/file'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormFile } from '@vitnode/core/components/form/fields/file'
import { AutoFormFiles } from '@vitnode/core/components/form/fields/files'
import { toast } from 'sonner'
import { z } from 'zod'

const MAX_BYTES = 5 * 1024 * 1024

let nextFileId = 1

const fakeUpload = async (file: File): Promise<AutoFormFileValue> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 1200)
  })

  return {
    id: nextFileId++,
    mimeType: file.type,
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file),
  }
}

export default function AttachmentAutoFormExample() {
  const formSchema = z.object({
    avatar: z.number().nullable().default(null),
    gallery: z.array(z.number()).max(4).default([]),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'avatar',
          component: (props) => (
            <AutoFormFile
              {...props}
              allowedExtensions={['.png', '.jpg', '.webp']}
              label="Avatar"
              maxBytes={MAX_BYTES}
              onUpload={fakeUpload}
            />
          ),
        },
        {
          id: 'gallery',
          component: (props) => (
            <AutoFormFiles
              {...props}
              allowedExtensions={['.png', '.jpg', '.webp']}
              label="Gallery"
              maxBytes={MAX_BYTES}
              maxItems={4}
              onUpload={fakeUpload}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Files saved', {
          description: `Avatar #${values.avatar ?? 'none'}, gallery: ${values.gallery.length} file(s).`,
        })
      }}
    />
  )
}
