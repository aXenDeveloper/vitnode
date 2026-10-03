const WEIGHTS = [
  { className: 'font-normal', label: 'Regular · 400' },
  { className: 'font-medium', label: 'Medium · 500' },
  { className: 'font-semibold', label: 'Semibold · 600' },
] as const

export default function TypographySpecimen() {
  return (
    <div className="not-prose flex w-full flex-col gap-6 sm:flex-row sm:items-center">
      <span
        aria-hidden
        className="text-8xl leading-none font-semibold sm:w-48 sm:text-center"
      >
        Aa
      </span>
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground font-mono text-xs leading-relaxed">
          system-ui: San Francisco · Segoe UI · Roboto
        </p>
        <ul className="flex flex-col gap-2">
          {WEIGHTS.map((weight) => (
            <li
              className="flex items-baseline justify-between gap-4"
              key={weight.label}
            >
              <span className={`text-xl ${weight.className}`}>Community</span>
              <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                {weight.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
