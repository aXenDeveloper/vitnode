import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@vitnode/core/components/ui/alert'

export default function AlertDemo() {
  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <Alert>
        <AlertTitle>Drafts are private</AlertTitle>
        <AlertDescription>
          Only you and staff can see a topic until you publish it.
        </AlertDescription>
      </Alert>
      <Alert variant="info">
        <AlertTitle>Reindexing runs in the background</AlertTitle>
        <AlertDescription>
          Keep editing while the search index rebuilds.
        </AlertDescription>
      </Alert>
      <Alert variant="success">
        <AlertTitle>Changes saved</AlertTitle>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Cron adapter missing</AlertTitle>
        <AlertDescription>
          Scheduled jobs won&apos;t run until you configure one in Integrations.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Unable to reach the search engine</AlertTitle>
        <AlertDescription>
          Check the connection settings and try again.
        </AlertDescription>
      </Alert>
    </div>
  )
}
