import { Button } from '@vitnode/core/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'

export default function CardBorderSeparationExample() {
  return (
    <Card className="not-prose w-full max-w-xs gap-0 p-0">
      <CardHeader className="items-center px-4 py-2">
        <CardTitle>Reports</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline">
            Filter
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="border-y px-4 py-3">
        <p className="leading-relaxed">
          2 posts were reported for spam in the last hour.
        </p>
      </CardContent>
      <CardFooter className="border-none px-4 py-3">
        <Button className="w-full" variant="outline">
          Open queue
        </Button>
      </CardFooter>
    </Card>
  )
}
