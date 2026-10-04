import { Spinner } from '@vitnode/core/components/ui/spinner'

const sizes = ['sm', 'default', 'lg', 'xl'] as const

export default function SpinnerExample() {
  return (
    <div className="not-prose flex flex-col items-center gap-8">
      <div className="flex items-end gap-6">
        {sizes.map((size) => (
          <div className="flex flex-col items-center gap-2" key={size}>
            <Spinner size={size} />
            <span className="text-muted-foreground text-xs">{size}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-6">
        <Spinner className="text-primary" size="lg" />
        <Spinner className="text-success" size="lg" />
        <Spinner className="text-warn" size="lg" />
        <Spinner className="text-destructive" size="lg" />
        <Spinner className="text-muted-foreground" size="lg" />
      </div>
    </div>
  )
}
