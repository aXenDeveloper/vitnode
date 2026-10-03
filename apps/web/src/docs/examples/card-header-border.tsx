import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'

export default function CardHeaderBorderExample() {
  return (
    <Card className="not-prose w-full max-w-xs">
      <CardHeader className="border-b">
        <CardTitle>Community rules</CardTitle>
        <CardDescription>Last updated in March</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="leading-relaxed">
          Be kind, stay on topic and search before you post. Moderators may
          close duplicate threads.
        </p>
      </CardContent>
    </Card>
  )
}
