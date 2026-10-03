import { BellIcon } from 'lucide-react'

const SIZES = [
  {
    className: 'size-3',
    label: 'size-3',
    px: '12px',
    use: 'Badges, xs buttons',
  },
  {
    className: 'size-3.5',
    label: 'size-3.5',
    px: '14px',
    use: 'Inline with text-xs',
  },
  {
    className: 'size-4',
    label: 'size-4',
    px: '16px',
    use: 'Default: buttons, menus, inputs',
  },
  {
    className: 'size-5',
    label: 'size-5',
    px: '20px',
    use: 'Navigation, list rows',
  },
  {
    className: 'size-6',
    label: 'size-6',
    px: '24px',
    use: 'Empty states, feature tiles',
  },
] as const

export default function IconsSizes() {
  return (
    <ul className="flex w-full flex-col">
      {SIZES.map((size) => (
        <li
          className="flex items-center gap-4 border-b py-3 last:border-b-0"
          key={size.label}
        >
          <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
            <BellIcon className={size.className} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="flex shrink-0 gap-2 font-mono text-xs sm:w-32">
              <span>{size.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {size.px}
              </span>
            </span>
            <span className="text-muted-foreground text-sm leading-relaxed">
              {size.use}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
