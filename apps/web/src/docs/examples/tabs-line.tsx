import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from '@vitnode/core/components/ui/tabs'

export default function TabsLineDemo() {
  return (
    <Tabs className="w-full" defaultValue="posts">
      <TabsList variant="line">
        <TabsTrigger value="posts">Posts</TabsTrigger>
        <TabsTrigger value="comments">Comments</TabsTrigger>
        <TabsTrigger value="followers">Followers</TabsTrigger>
      </TabsList>

      <TabsPanels>
        <TabsContent value="posts">
          <p className="text-muted-foreground leading-relaxed text-pretty">
            The underline follows the active tab instead of a filled pill.
          </p>
        </TabsContent>

        <TabsContent value="comments">
          <p className="text-muted-foreground leading-relaxed text-pretty">
            Same motion, quieter chrome. Handy for profile pages and feeds.
          </p>
        </TabsContent>

        <TabsContent value="followers">
          <p className="text-muted-foreground leading-relaxed text-pretty">
            Nobody here yet. Be the first one.
          </p>
        </TabsContent>
      </TabsPanels>
    </Tabs>
  )
}
