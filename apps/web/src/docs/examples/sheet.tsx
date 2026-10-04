import { Button } from '@vitnode/core/components/ui/button'
import { Label } from '@vitnode/core/components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@vitnode/core/components/ui/sheet'
import { Switch } from '@vitnode/core/components/ui/switch'
import { BellIcon } from 'lucide-react'

const preferences = [
  {
    id: 'replies',
    label: 'Replies to my posts',
    hint: 'Someone answered you. Exciting!',
    defaultChecked: true,
  },
  {
    id: 'mentions',
    label: 'Mentions',
    hint: 'Someone wrote your @name.',
    defaultChecked: true,
  },
  {
    id: 'followers',
    label: 'New followers',
    hint: 'Your fan club is growing.',
    defaultChecked: false,
  },
  {
    id: 'digest',
    label: 'Weekly digest',
    hint: 'The best threads, every Monday.',
    defaultChecked: false,
  },
]

export default function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline">
            <BellIcon />
            Notifications
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Pick what lands in your inbox. Changes save right away.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-5 px-4">
          {preferences.map(({ defaultChecked, hint, id, label }) => (
            <li className="flex items-center justify-between gap-4" key={id}>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`sheet-${id}`}>{label}</Label>
                <span className="text-muted-foreground text-sm leading-relaxed">
                  {hint}
                </span>
              </div>
              <Switch defaultChecked={defaultChecked} id={`sheet-${id}`} />
            </li>
          ))}
        </ul>
        <SheetFooter>
          <SheetClose render={<Button variant="outline">Done</Button>} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
