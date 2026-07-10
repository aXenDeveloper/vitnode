import { ArrowUpRightIcon, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type IntegrationStatus = "active" | "inactive" | "warning";

export interface IntegrationCardProps {
  action?: React.ReactNode;
  description: string;
  href: string;
  Icon: LucideIcon;
  meta?: React.ReactNode;
  readMoreLabel: string;
  status: IntegrationStatus;
  statusLabel: string;
  title: string;
}

export const IntegrationCard = ({
  action,
  description,
  href,
  Icon,
  meta,
  readMoreLabel,
  status,
  statusLabel,
  title,
}: IntegrationCardProps) => {
  const isActive = status === "active";
  const isWarning = status === "warning";

  return (
    <Card
      className={cn(
        "gap-0 p-0 transition-colors",
        // An inactive integration is a problem worth noticing - give the whole
        // card a destructive tint so it reads as "danger" at a glance.
        status === "inactive" && "ring-destructive/30",
        isWarning && "ring-amber-500/40",
      )}
      data-status={status}
    >
      <div
        className={cn(
          "bg-card flex flex-1 flex-col gap-4 p-6",
          status === "inactive" && "bg-destructive/3",
          isWarning && "bg-amber-500/4",
        )}
      >
        <CardHeader className="p-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                isActive && "bg-primary/10 text-primary",
                isWarning &&
                  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                status === "inactive" && "bg-destructive/10 text-destructive",
              )}
            >
              <Icon className="size-5" />
            </div>
            <CardTitle className="flex-1">{title}</CardTitle>
          </div>
          <CardAction>
            <Badge
              className={cn(
                isActive &&
                  "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-400",
                isWarning &&
                  "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
              )}
              variant={status === "inactive" ? "destructive" : "secondary"}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full bg-current",
                  isActive && "animate-pulse",
                )}
              />
              {statusLabel}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <CardDescription>{description}</CardDescription>
          {meta ? (
            <div className="text-muted-foreground mt-3 text-xs">{meta}</div>
          ) : null}
        </CardContent>
      </div>
      <CardFooter
        className={cn(
          "bg-muted items-center gap-2 px-6 py-4",
          action ? "justify-between" : "justify-end",
        )}
      >
        {action}
        <a
          className={cn(
            buttonVariants({ size: "sm", variant: "link" }),
            "text-muted-foreground hover:text-foreground gap-1",
          )}
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {readMoreLabel}
          <ArrowUpRightIcon />
        </a>
      </CardFooter>
    </Card>
  );
};
