import { useFormatter, useNow } from "use-intl";

import { TooltipWithContent } from "./ui/tooltip";

/**
 * A date in the visitor's language: relative ("5 minutes ago", with the full
 * date in a tooltip) when it is less than a week old, the full date and time
 * otherwise. The year is left out for dates in the current year.
 */
export const DateFormat = ({
  date,
  updateInterval,
  showFullDate,
}: {
  /** A `Date` or anything `new Date()` parses, such as an ISO string from the API. */
  date: Date | string;
  /** Always shows the full date and time. */
  showFullDate?: boolean;
  /**
   * How often a relative date re-renders, in ms. Defaults to every minute for
   * dates less than a day old and never otherwise.
   */
  updateInterval?: number;
}) => {
  const dateToFormat = typeof date === "string" ? new Date(date) : date;
  const format = useFormatter();
  const now = useNow({
    updateInterval:
      updateInterval ??
      // Update it every 1 minute if the date is from today, otherwise don't update
      // oxlint-disable-next-line react/purity, @eslint-react/purity
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

  if (now.getTime() - dateToFormat.getTime() < 604800000) {
    return (
      <TooltipWithContent text={fullDate}>
        <span suppressHydrationWarning>
          {format.relativeTime(dateToFormat, now)}
        </span>
      </TooltipWithContent>
    );
  }

  return fullDate;
};
