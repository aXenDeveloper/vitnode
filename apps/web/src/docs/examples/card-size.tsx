import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'

const sizes = [
  { size: 'default', title: 'Default', spacing: '24px' },
  { size: 'sm', title: 'Small', spacing: '16px' },
] as const

export default function CardSizeExample() {
  return (
    <div className="not-prose grid w-full gap-4 sm:grid-cols-2">
      {sizes.map((item) => (
        <Card key={item.size} size={item.size}>
          <CardHeader>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.spacing} spacing</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">1,204 members online right now.</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
