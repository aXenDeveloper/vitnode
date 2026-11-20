import { ShortNumber } from '@vitnode/core/components/ui/short-number'

const STATS = [
  { label: 'Members', value: 842 },
  { label: 'Posts', value: 12480 },
  { label: 'Views', value: 3_456_789 },
]

export default function ShortNumberExample() {
  return (
    <dl className="not-prose grid w-full max-w-md grid-cols-3 gap-4 text-center">
      {STATS.map(({ label, value }) => (
        <div className="flex flex-col gap-1" key={label}>
          <dt className="text-muted-foreground text-sm">{label}</dt>
          <dd className="text-3xl font-semibold">
            <ShortNumber value={value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
