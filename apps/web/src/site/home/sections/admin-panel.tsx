import { CpuIcon, LockIcon, PlugIcon, SparklesIcon } from 'lucide-react'

import adminControlPanel from '#/site/home/assets/admin-control-panel.png'

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
            decoding="async"
            fetchPriority="low"
            height={1392}
            loading="lazy"
            src={adminControlPanel}
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
