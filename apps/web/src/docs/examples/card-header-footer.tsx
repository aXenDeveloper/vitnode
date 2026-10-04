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
    <Card className="not-prose w-full max-w-xs">
      <CardHeader className="border-b">
        <CardTitle>Pending approval</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="leading-relaxed">
          3 new members are waiting for a moderator to approve their accounts.
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline">
          Review members
        </Button>
      </CardFooter>
    </Card>
  )
}
