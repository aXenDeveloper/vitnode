"use client";

import { CheckIcon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

interface SelectableCardProps {
  description: React.ReactNode;
  icon: React.ReactNode;
  onSelect: () => void;
  selected: boolean;
  title: React.ReactNode;
}

export const SelectableCard = ({
  selected,
  onSelect,
  icon,
  title,
  description,
}: SelectableCardProps) => {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "group focus-visible:ring-ring/50 relative flex items-start gap-3 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-[3px] sm:gap-4",
        selected
          ? "border-primary ring-primary/20 bg-primary/4 ring-1"
          : "border-border hover:border-foreground/20 hover:bg-muted/40",
      )}
      onClick={onSelect}
      type="button"
    >
      {icon}

      <div className="min-w-0 flex-1 space-y-1 pe-7">
        <p className="leading-none font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm leading-snug">
          {description}
        </p>
      </div>

      <span
        className={cn(
          "absolute inset-e-4 top-4 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input",
        )}
      >
        {selected ? <CheckIcon className="size-3.5" /> : null}
      </span>
    </button>
  );
};
