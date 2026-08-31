import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'

export default function CardExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        This is the content of the card. You can put any content here.
      </CardContent>
      <CardFooter>
        <CardAction>Action Button</CardAction>
      </CardFooter>
    </Card>
  )
}
