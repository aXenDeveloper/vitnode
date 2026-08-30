import { cn } from '@vitnode/core/lib/utils'
import { ImageZoom } from 'fumadocs-ui/components/image-zoom'

/**
 * A screenshot inside a document, framed and click-to-zoom.
 *
 * Seven MDX files import this **by path** - `@/components/fumadocs/img` - so the
 * module has to keep both its location and its name. That is the whole reason it
 * is here rather than in `src/docs/`: the alias and the path are part of the
 * content, and moving the file would mean editing the copied documentation to
 * suit the implementation.
 *
 * Carried over from the Next.js application unchanged apart from its import
 * style. It takes a Vite asset import as `src`, which is a URL string here
 * rather than Next's `StaticImport` - so `next/image` never comes into it, and
 * the plain `<img>` inside `ImageZoom` is what renders.
 */
export const ImgDocs = ({
  className,
  imgClassName,
  withoutBackground,
  ...props
}: React.ComponentProps<typeof ImageZoom> & {
  imgClassName?: string
  withoutBackground?: boolean
}) => (
  <div
    className={cn(
      'flex items-center justify-center rounded-xl border',
      {
        'from-fd-primary/10 bg-gradient-to-br *:max-w-[26rem]':
          !withoutBackground,
      },
      { '*:max-w-[36rem]': withoutBackground },
      className,
    )}
  >
    <ImageZoom className={cn('rounded-lg', imgClassName)} {...props} />
  </div>
)
