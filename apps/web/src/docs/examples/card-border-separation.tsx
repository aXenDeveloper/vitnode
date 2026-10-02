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
    <Card className="w-full max-w-xs gap-0 p-0">
      <CardHeader className="flex items-center justify-between px-4 py-2">
        <CardTitle>Header</CardTitle>
        <CardAction>
          <Button variant="outline">Action</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="border-y px-4 py-3">
        <p>
          The content has border-y applied, splitting the card into three clean
          sections.
        </p>
      </CardContent>
      <CardFooter className="border-none px-4 py-3">
        <Button className="w-full" variant="outline">
          Action
        </Button>
      </CardFooter>
    </Card>
  )
}
