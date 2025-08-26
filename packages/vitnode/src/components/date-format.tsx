"use client";

import { useFormatter, useNow } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export const DateFormat = ({
  date,
  updateInterval,
  showFullDate,
}: {
  date: Date | string;
  showFullDate?: boolean;
  updateInterval?: number;
}) => {
  const dateToFormat = typeof date === "string" ? new Date(date) : date;
  const format = useFormatter();
  const now = useNow({
    updateInterval:
      updateInterval ??
      // Update it every 1 minute if the date is from today, otherwise don't update
      (Date.now() - dateToFormat.getTime() < 86400000 ? 60000 : 0),
  });

  const fullDate = format.dateTime(dateToFormat, {
    year:
      dateToFormat.getFullYear() === now.getFullYear() ? undefined : "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

  if (showFullDate) {
    return fullDate;
  }

  // When date is < 7 days
  if (now.getTime() - dateToFormat.getTime() < 604800000) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{format.relativeTime(dateToFormat, now)}</span>
          </TooltipTrigger>

          <TooltipContent>{fullDate}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return fullDate;
};
