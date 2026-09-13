import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from '@vitnode/core/components/ui/tabs'

export default function TabsDemo() {
  return (
    <Tabs className="w-full" defaultValue="overview">
      <TabsList className="w-full">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>

      <TabsPanels>
        <TabsContent className="flex flex-col gap-2" value="overview">
          <h3 className="text-base font-semibold">Overview</h3>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            Everything you need to know at a glance. Switch tabs and watch the
            panel slide in from the side you came from.
          </p>
        </TabsContent>

        <TabsContent className="flex flex-col gap-2" value="activity">
          <h3 className="text-base font-semibold">Activity</h3>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            A taller panel, on purpose.
          </p>
          <ul className="text-muted-foreground flex flex-col gap-2 leading-relaxed">
            <li>Signed in from a new device</li>
            <li>Updated the profile cover</li>
            <li>Joined the moderators role</li>
            <li>Published a first article</li>
          </ul>
        </TabsContent>

        <TabsContent className="flex flex-col gap-2" value="billing">
          <h3 className="text-base font-semibold">Billing</h3>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            Short and sweet. The panel wrapper animates its height, so the
            layout never jumps between tabs.
          </p>
        </TabsContent>
      </TabsPanels>
    </Tabs>
  )
}
