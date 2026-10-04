import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@vitnode/core/components/ui/empty'

export default function EmptyCompactExample() {
  return (
    <Card className="not-prose w-full max-w-xs" size="sm">
      <CardHeader>
        <CardTitle>Sidebar widgets</CardTitle>
      </CardHeader>
      <CardContent>
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyTitle className="text-sm" render={<p />}>
              No widgets yet
            </EmptyTitle>
            <EmptyDescription className="text-xs">
              Widgets from your plugins will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  )
}
