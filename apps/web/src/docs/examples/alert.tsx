import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@vitnode/core/components/ui/alert'

export default function AlertDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <Alert variant="info">
        <AlertTitle>Reindexing runs in the background</AlertTitle>
        <AlertDescription>
          You can keep editing content while the search index rebuilds.
        </AlertDescription>
      </Alert>

      <Alert variant="success">
        <AlertTitle>Changes saved</AlertTitle>
        <AlertDescription>
          Your search index settings have been updated.
        </AlertDescription>
      </Alert>

      <Alert variant="warning">
        <AlertTitle>
          Background jobs require a configured cron adapter
        </AlertTitle>
        <AlertDescription>
          A rebuild won&apos;t run until cron is active. Configure an adapter in
          Integrations to enable scheduled reindexing.
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
