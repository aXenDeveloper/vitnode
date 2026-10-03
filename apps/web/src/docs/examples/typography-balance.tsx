const HEADLINE = 'Build a community your members actually enjoy visiting'

const Column = ({
  className,
  good,
  label,
}: {
  className: string
  good: boolean
  label: string
}) => (
  <figure className="bg-card flex flex-col gap-3 rounded-lg border p-4">
    <figcaption
      className={`font-mono text-xs ${good ? 'text-success' : 'text-muted-foreground'}`}
    >
      {label}
    </figcaption>
    <p className={`max-w-56 text-2xl font-semibold ${className}`}>{HEADLINE}</p>
  </figure>
)

export default function TypographyBalance() {
  return (
    <div className="not-prose grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <Column className="text-wrap" good={false} label="default wrap" />
      <Column className="text-balance" good label="text-balance" />
    </div>
  )
}
