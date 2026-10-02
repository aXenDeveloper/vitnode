import { Button } from '@vitnode/core/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'

export default function CardExample() {
  return (
    <Card className="w-full max-w-xs">
      <CardHeader>
        <CardTitle>Default Card</CardTitle>
        <CardDescription>
          This card uses the default size variant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          The card component supports a size prop that defaults to
          &quot;default&quot; for standard spacing and sizing.
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
