import { Spinner } from '@vitnode/core/components/ui/spinner'

export default function ShimmerExample() {
  return (
    <div className="not-prose bg-card text-card-foreground flex w-full flex-col items-center gap-6 rounded-xl border p-6 text-center">
      <p className="shimmer text-muted-foreground text-2xl font-medium">
        Thinking...
      </p>
      <p className="shimmer text-sm leading-relaxed">
        Generating a response worth the wait...
      </p>
      <div
        className="bg-muted text-muted-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
        role="status"
      >
        <Spinner aria-hidden="true" />
        <span className="shimmer">Reading 4 files</span>
      </div>
    </div>
  )
}
