import { Button } from '@vitnode/core/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@vitnode/core/components/ui/drawer'
import { FlagIcon } from 'lucide-react'
import { toast } from 'sonner'

const reasons = ['Spam', 'Harassment', 'Off-topic', 'Something else']

export default function DrawerExample() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <FlagIcon />
          Report post
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-sm flex-col">
          <DrawerHeader>
            <DrawerTitle>What&apos;s wrong with this post?</DrawerTitle>
            <DrawerDescription>
              Moderators see your report. The author doesn&apos;t.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4">
            {reasons.map((reason) => (
              <DrawerClose asChild key={reason}>
                <Button
                  className="justify-start"
                  onClick={() =>
                    toast.success('Report sent', {
                      description: `Reason: ${reason}`,
                    })
                  }
                  variant="secondary"
                >
                  {reason}
                </Button>
              </DrawerClose>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
