'use client';

import { Button } from '@vitnode/core/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@vitnode/core/components/ui/popover';

export default function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open</Button>
      </PopoverTrigger>
      <PopoverContent>Place content for the popover here.</PopoverContent>
    </Popover>
  );
}
