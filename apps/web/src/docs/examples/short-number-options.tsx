import { ShortNumber } from '@vitnode/core/components/ui/short-number'

export default function ShortNumberOptionsExample() {
  return (
    <ul className="not-prose flex flex-col gap-3 text-sm">
      <li className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">With a sign</span>
        <span className="flex gap-3 font-semibold">
          <ShortNumber
            formatOptions={{ signDisplay: 'exceptZero' }}
            value={1250}
          />
          <ShortNumber
            formatOptions={{ signDisplay: 'exceptZero' }}
            value={-37}
          />
        </span>
      </li>
      <li className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Without a tooltip</span>
        <ShortNumber className="font-semibold" tooltip={false} value={48_200} />
      </li>
      <li className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Shortened from 10,000</span>
        <span className="flex gap-3 font-semibold">
          <ShortNumber threshold={10_000} value={9_999} />
          <ShortNumber threshold={10_000} value={10_500} />
        </span>
      </li>
    </ul>
  )
}
