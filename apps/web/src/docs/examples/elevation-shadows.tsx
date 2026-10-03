const SHADOWS = [
  { className: 'shadow-2xs', usage: 'Flat rows that need a hint' },
  { className: 'shadow-xs', usage: 'Buttons, inputs, cards' },
  { className: 'shadow-sm', usage: 'Slider thumbs, active tabs' },
  { className: 'shadow-md', usage: 'Navigation menus' },
  { className: 'shadow-lg', usage: 'Popovers, menus, sheets' },
  { className: 'shadow-xl', usage: 'Dialogs' },
] as const

export default function ElevationShadows() {
  return (
    <ul className="bg-background m-0 grid list-none w-full grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-3 sm:gap-6 sm:p-6">
      {SHADOWS.map((shadow) => (
        <li
          className={`bg-card text-card-foreground m-0 ring-foreground/5 flex min-h-24 flex-col justify-end gap-1 rounded-xl p-3 ring-1 ${shadow.className}`}
          key={shadow.className}
        >
          <span className="font-mono text-xs">{shadow.className}</span>
          <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {shadow.usage}
          </span>
        </li>
      ))}
    </ul>
  )
}
