import { Alert, AlertTitle } from '@vitnode/core/components/ui/alert'
import { HardDriveIcon } from 'lucide-react'

export default function AlertIcon() {
  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <Alert icon={<HardDriveIcon />} variant="info">
        <AlertTitle>Storage is connected</AlertTitle>
      </Alert>
      <Alert icon={null} variant="success">
        <AlertTitle>Backup finished, no icon needed</AlertTitle>
      </Alert>
    </div>
  )
}
