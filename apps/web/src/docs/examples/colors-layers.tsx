import { Badge } from '@vitnode/core/components/ui/badge'

const LayerTag = ({ name }: { name: string }) => (
  <span className="bg-foreground text-background w-fit rounded-sm px-1.5 py-0.5 font-mono text-xs">
    {name}
  </span>
)

export default function ColorsLayers() {
  return (
    <div className="not-prose bg-background text-foreground flex w-full flex-col gap-3 rounded-xl border p-4">
      <LayerTag name="background" />
      <div className="bg-card text-card-foreground flex flex-col gap-3 rounded-lg border p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <LayerTag name="card" />
          <Badge variant="success">Published</Badge>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Release notes for May</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Updated 2 hours ago by Ada
          </p>
        </div>
        <div className="bg-popover text-popover-foreground flex flex-col gap-1 self-end rounded-lg border p-1 shadow-lg sm:w-48">
          <div className="px-2 pt-1">
            <LayerTag name="popover" />
          </div>
          <span className="bg-accent text-accent-foreground rounded-sm px-2 py-1.5 text-sm">
            Edit
          </span>
          <span className="px-2 py-1.5 text-sm">Duplicate</span>
          <span className="text-destructive px-2 py-1.5 text-sm">Delete</span>
        </div>
      </div>
    </div>
  )
}
