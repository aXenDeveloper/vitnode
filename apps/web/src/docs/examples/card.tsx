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
    <Card className="not-prose w-full max-w-xs">
      <CardHeader>
        <CardTitle>Weekly digest</CardTitle>
        <CardDescription>Sent every Monday at 9:00</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="leading-relaxed">
          A roundup of the top threads, new members and unanswered questions
          from your community.
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline">
          Preview email
        </Button>
      </CardFooter>
    </Card>
  )
}
