import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from '@vitnode/core/components/ui/tabs'

const SECTIONS = [
  {
    value: 'general',
    label: 'General',
    body: 'Community name, logo and the language new members see first.',
  },
  {
    value: 'members',
    label: 'Members',
    body: 'Who can register, whether new accounts need approval and which role they start with.',
  },
  {
    value: 'email',
    label: 'Email',
    body: 'Sender address and the templates for welcome and password reset emails.',
  },
]

export default function TabsVerticalDemo() {
  return (
    <Tabs
      className="not-prose w-full"
      defaultValue="general"
      orientation="vertical"
    >
      <TabsList className="shrink-0">
        {SECTIONS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsPanels className="flex-1">
        {SECTIONS.map(({ value, label, body }) => (
          <TabsContent
            className="flex flex-col gap-1"
            key={value}
            value={value}
          >
            <h3 className="text-foreground text-base font-semibold">{label}</h3>
            <p className="text-muted-foreground leading-relaxed text-pretty">
              {body}
            </p>
          </TabsContent>
        ))}
      </TabsPanels>
    </Tabs>
  )
}
