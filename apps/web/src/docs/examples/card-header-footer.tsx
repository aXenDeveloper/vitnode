import { Button } from '@vitnode/core/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'

export default function CardHeaderFooterExample() {
  return (
    <Card className="w-full max-w-xs">
      <CardHeader className="border-b">
        <CardTitle>Header with Border</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          The footer has a top border and a soft background, creating a visual
          separation between the content and footer sections.
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline">
          Action
        </Button>
      </CardFooter>
    </Card>
  )
}
