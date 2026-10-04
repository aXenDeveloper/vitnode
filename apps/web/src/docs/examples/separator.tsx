import { Separator } from '@vitnode/core/components/ui/separator'

export default function SeparatorDemo() {
  return (
    <div className="not-prose flex w-full max-w-xs flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground text-sm font-medium">
          VitNode Community
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Plugins, themes and help from people who build with VitNode.
        </p>
      </div>
      <Separator />
      <div className="text-foreground flex h-5 items-center gap-4 text-sm">
        <span>Forum</span>
        <Separator orientation="vertical" />
        <span>Blog</span>
        <Separator orientation="vertical" />
        <span>Docs</span>
      </div>
    </div>
  )
}
