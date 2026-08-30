import { CpuIcon, LockIcon, PlugIcon, SparklesIcon } from 'lucide-react'

/**
 * The four claims under the screenshot.
 *
 * The Next.js page shipped four cards that all read "Powerful" over the same
 * sentence, three of them under a different icon - placeholder copy that was
 * never filled in. Migrating it verbatim would ship it, so each card now says
 * what its icon has always said. That is the smallest edit that leaves a
 * publishable section, and every line of it is a statement VitNode's AdminCP
 * already makes elsewhere in this repository; it is not new positioning.
 */
const FEATURES = [
  {
    description:
      'Manage users, content and settings from one command center, without a second dashboard to keep in step.',
    Icon: CpuIcon,
    title: 'Powerful',
  },
  {
    description:
      'Roles and per-plugin permissions decide what each member of staff can open, down to the individual screen.',
    Icon: LockIcon,
    title: 'Secure',
  },
  {
    description:
      'Every plugin registers its own AdminCP screens and navigation, and they appear alongside the built-in ones.',
    Icon: PlugIcon,
    title: 'Extensible',
  },
  {
    description:
      'The Content Engine builds the tables, the forms and the translations for a new content type for you.',
    Icon: SparklesIcon,
    title: 'Productive',
  },
]

/**
 * The Admin Control Panel section: one screenshot, four claims.
 *
 * ## The screenshot is a file this application serves, not an import
 *
 * `/admin-control-panel.png` lives in `apps/web/public`, which is the ownership
 * decision this section exists to record. It is a photograph of vitnode.com's
 * own AdminCP - a marketing asset for one website - and `@vitnode/core` is a
 * framework that thousands of installs render. A screenshot of *our* panel does
 * not belong in a package every one of them ships.
 *
 * The Next.js page rendered the same file twice - once `dark:hidden`, once
 * `hidden dark:block` - from the same import, with the same pixels, under two
 * different alt texts. That is a second decode and a second entry in the
 * accessibility tree for no visual difference at all, so it is one `<img>` here.
 * The gradient above it is what blends it into either theme, and always was.
 *
 * `width` and `height` are the file's real intrinsic size. The Next.js page
 * declared 2797x1137 against a 2880x1392 file, which is a wrong aspect ratio
 * for the browser to reserve space with; `aspect-88/36` on the frame was doing
 * the work regardless.
 */
export const AdminSection = () => (
  <section className="py-16 md:py-32">
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6">
      <div className="flex items-center justify-center text-center">
        <h2 className="max-w-xl text-4xl font-semibold text-balance">
          Powerful AdminCP brings together all management tools
        </h2>
      </div>

      <div className="relative rounded-3xl p-3 md:-mx-8 lg:col-span-3">
        <div className="relative aspect-88/36">
          <div className="from-background absolute inset-0 z-1 bg-linear-to-t to-transparent" />

          <img
            alt="The VitNode Admin Control Panel, showing the debug screen alongside the sidebar of management sections."
            height={1392}
            src="/admin-control-panel.png"
            width={2880}
          />
        </div>
      </div>

      <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
        {FEATURES.map(({ Icon, description, title }) => (
          <div className="flex flex-col gap-3" key={title}>
            <div className="flex items-center gap-2">
              <Icon aria-hidden className="size-4" />
              <h3 className="text-sm font-medium">{title}</h3>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
)
