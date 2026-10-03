import type {
  AutoFormFileValue,
  FileUploadOptions,
} from '@vitnode/core/components/form/fields/file'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormFile } from '@vitnode/core/components/form/fields/file'
import { AutoFormFiles } from '@vitnode/core/components/form/fields/files'
import { toast } from 'sonner'
import { z } from 'zod'

const MAX_BYTES = 5 * 1024 * 1024
const UPLOAD_STEPS = 20
const STEP_MS = 120

let nextFileId = 1

const fakeUpload = async (
  file: File,
  { onProgress, signal }: FileUploadOptions,
): Promise<AutoFormFileValue> => {
  for (let step = 1; step <= UPLOAD_STEPS; step++) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, STEP_MS)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('Upload cancelled'))
      })
    })
    onProgress(step / UPLOAD_STEPS)
  }

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
      className="w-full"
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
