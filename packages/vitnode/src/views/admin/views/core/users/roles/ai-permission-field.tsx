import { cn } from "cn";
import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { AdminAiRolePermission } from "@/views/admin/views/core/ai/ai-query";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { FormControl, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiActionIcon } from "@/views/admin/views/core/ai/ai-labels";

const LIMIT_PANEL = "limit";

export const AutoFormAiPermission = ({
  children,
  field,
  labels,
  permission,
}: ItemAutoFormComponentProps & {
  labels: { label: string; value: string }[];
  permission: AdminAiRolePermission;
}) => {
  const id = React.useId();
  const titleIdOf = (index: number) => `${id}-title-${index}`;
  const panelId = `${id}-limit`;
  const value = typeof field.value === "string" ? field.value : "default";
  const isAllowed =
    value === "allow" || (value === "default" && permission.defaultGranted);

  return (
    <div className="rounded-lg border">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {permission.actions.map((action, index) => (
              <li className="flex items-start gap-3" key={action.key}>
                <AiActionIcon enabled={isAllowed} icon={action.icon} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      "font-medium text-pretty transition-colors",
                      isAllowed ? "text-foreground" : "text-muted-foreground",
                    )}
                    id={titleIdOf(index)}
                  >
                    {action.title}
                  </span>
                  <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
                    {action.description}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <span className="text-muted-foreground font-mono text-xs break-all">
            {permission.key}
          </span>
        </div>

        <FormControl>
          <Select
            items={labels}
            onValueChange={next => {
              field.onChange(next);
            }}
            value={value}
          >
            <SelectTrigger
              aria-controls={children ? panelId : undefined}
              aria-expanded={children ? value === "allow" : undefined}
              aria-labelledby={permission.actions
                .map((_, index) => titleIdOf(index))
                .join(" ")}
              className="w-full shrink-0 sm:w-48"
              onBlur={field.onBlur}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labels.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormControl>
      </div>

      <FormMessage />

      {!!children && (
        <Accordion value={value === "allow" ? [LIMIT_PANEL] : []}>
          <AccordionItem value={LIMIT_PANEL}>
            <AccordionContent
              className="flex flex-col gap-6 border-t p-4 text-base"
              id={panelId}
              role="group"
            >
              {children}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};
