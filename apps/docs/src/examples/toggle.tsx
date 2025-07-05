'use client';

import { Toggle } from '@vitnode/core/components/ui/toggle';
import { Bold } from 'lucide-react';

export default function SonnerDemo() {
  return (
    <Toggle aria-label="Toggle italic">
      <Bold className="size-4" />
    </Toggle>
  );
}
