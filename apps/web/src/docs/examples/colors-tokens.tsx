import { CopyButton } from '@vitnode/core/components/ui/copy-button'

import { useCssVariables } from '../use-css-variables'

const GROUPS = [
  {
    label: 'Surfaces',
    tokens: [
      { name: 'background', className: 'bg-background text-foreground' },
      { name: 'card', className: 'bg-card text-card-foreground' },
      { name: 'popover', className: 'bg-popover text-popover-foreground' },
      { name: 'muted', className: 'bg-muted text-muted-foreground' },
      {
        name: 'secondary',
        className: 'bg-secondary text-secondary-foreground',
      },
      { name: 'accent', className: 'bg-accent text-accent-foreground' },
    ],
  },
  {
    label: 'Brand and status',
    tokens: [
      { name: 'primary', className: 'bg-primary text-primary-foreground' },
      { name: 'success', className: 'bg-success text-background' },
      { name: 'warn', className: 'bg-warn text-background' },
      { name: 'destructive', className: 'bg-destructive text-background' },
    ],
  },
  {
    label: 'Lines',
    tokens: [
      { name: 'border', className: 'bg-border text-foreground' },
      { name: 'input', className: 'bg-input text-foreground' },
      { name: 'ring', className: 'bg-ring text-primary-foreground' },
    ],
  },
] as const

const TOKEN_NAMES = GROUPS.flatMap((group) =>
  group.tokens.map((token) => token.name),
)

export default function ColorsTokens() {
  const values = useCssVariables(TOKEN_NAMES)

  return (
    <div className="not-prose flex w-full flex-col gap-6">
      {GROUPS.map((group) => (
        <section className="flex flex-col gap-2" key={group.label}>
          <h3 className="text-muted-foreground text-xs font-medium">
            {group.label}
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.tokens.map((token) => (
              <li
                className="bg-card flex items-center gap-3 rounded-lg border p-2"
                key={token.name}
              >
                <div
                  aria-hidden
                  className={`flex size-12 shrink-0 items-center justify-center rounded-md border text-sm font-medium ${token.className}`}
                >
                  Aa
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono text-xs">{token.name}</span>
                  <span className="text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums">
                    {values[token.name] ?? '…'}
                  </span>
                </div>
                <CopyButton
                  aria-label={`Copy bg-${token.name}`}
                  content={`bg-${token.name}`}
                  size="icon-xs"
                  variant="ghost"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
