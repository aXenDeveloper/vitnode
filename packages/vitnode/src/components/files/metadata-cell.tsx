"use client";

import { BracesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export const MetadataCell = ({
  emptyLabel,
  metadata,
  title,
}: {
  emptyLabel: string;
  metadata: Record<string, unknown>;
  title: string;
}) => {
  const keys = Object.keys(metadata ?? {});

  if (keys.length === 0) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={<Badge className="cursor-pointer gap-1" variant="secondary" />}
      >
        <BracesIcon />
        {keys.length}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <PopoverTitle>{title}</PopoverTitle>
        <pre className="bg-muted mt-2 max-h-72 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </PopoverContent>
    </Popover>
  );
};
