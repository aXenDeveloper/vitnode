import { Marker, MarkerContent } from '@vitnode/core/components/ui/marker'

export default function MarkerVariantsExample() {
  return (
    <div className="not-prose flex w-full flex-col gap-6">
      <Marker>
        <MarkerContent>Ada pinned this thread</MarkerContent>
      </Marker>
      <Marker variant="separator">
        <MarkerContent>Yesterday</MarkerContent>
      </Marker>
      <Marker variant="border">
        <MarkerContent>Moved from Support to Plugins</MarkerContent>
      </Marker>
    </div>
  )
}
