import { useDataTableSelection } from '@vitnode/core/components/table/selection'
import { Button } from '@vitnode/core/components/ui/button'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

export const DeleteBulkAction = () => {
  const { clear, selected } = useDataTableSelection()

  return (
    <Button
      onClick={() => {
        toast.success(
          `Deleted ${selected.length} row(s): ${selected.join(', ')}`,
        )
        clear()
      }}
      size="sm"
      variant="destructive"
    >
      <Trash2Icon />
      Delete
    </Button>
  )
}
