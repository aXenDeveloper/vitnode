"use client";

import { Button } from "@vitnode/core/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@vitnode/core/components/ui/tooltip";

export default function TooltipDemo() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover</Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Add to library</p>
      </TooltipContent>
    </Tooltip>
  );
}
