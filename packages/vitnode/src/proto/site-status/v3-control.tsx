// PROTOTYPE site-status-admin: throwaway variant, delete after the decision.
import { richTextToPlainText } from "@vitnode/api/content/rich-text/plain-text";
import { cn } from "cn";
import {
  CalendarClockIcon,
  EyeIcon,
  HistoryIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PowerIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useLocale } from "use-intl";

import type { SiteStatusFormMode } from "@/views/admin/views/core/system/site-status/site-status-form-content";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { useLogo } from "@/components/logo-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  preloadSiteStatusForm,
  SiteStatusSheet,
} from "@/views/admin/views/core/system/site-status/site-status-sheet";
import { SiteOfflineContent } from "@/views/site-offline/site-offline-content";
import { getVitNodeConfig } from "@/vitnode.config";

import type { ProtoProps } from "./shared";

const PowerSwitch = ({
  canManage,
  offline,
  onTurnOff,
  onTurnOn,
}: {
  canManage: boolean;
  offline: boolean;
  onTurnOff: () => void;
  onTurnOn: () => void;
}) => (
  <div
    aria-label="Site status"
    className="bg-muted relative grid grid-cols-2 rounded-xl p-1"
    role="radiogroup"
  >
    <span
      aria-hidden="true"
      className={cn(
        "bg-card absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none",
        offline && "translate-x-full",
      )}
    />
    <button
      aria-checked={!offline}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed",
        offline
          ? "text-muted-foreground hover:text-foreground"
          : "text-success",
      )}
      disabled={!canManage}
      onClick={() => {
        if (offline) onTurnOn();
      }}
      role="radio"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          offline ? "bg-muted-foreground/40" : "bg-success",
        )}
      />
      Online
    </button>
    <button
      aria-checked={offline}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed",
        offline ? "text-warn" : "text-muted-foreground hover:text-foreground",
      )}
      disabled={!canManage}
      onClick={() => {
        if (!offline) onTurnOff();
      }}
      onFocus={preloadSiteStatusForm}
      onPointerEnter={preloadSiteStatusForm}
      role="radio"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          offline ? "bg-warn" : "bg-muted-foreground/40",
        )}
      />
      Offline
    </button>
  </div>
);

const Row = ({
  action,
  children,
  icon,
  label,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) => (
  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium">{label}</p>
        <div className="text-muted-foreground text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </div>
    {action}
  </div>
);

export const ControlVariant = ({
  canManage,
  data,
  fetchedAt,
  onSave,
}: ProtoProps) => {
  const [sheetMode, setSheetMode] = React.useState<null | SiteStatusFormMode>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const locale = useLocale();
  const logo = useLogo();
  const format = useFormatter();
  const defaultLocale = getVitNodeConfig().i18n.defaultLocale;
  const mainMessage =
    data.message.find(item => item.languageCode === defaultLocale) ??
    data.message[0];
  const messageText = mainMessage ? richTextToPlainText(mainMessage.value) : "";

  const turnOn = async ({ onClose }: { onClose: () => void }) => {
    const opensAtPassed =
      data.opensAt !== null && Date.parse(data.opensAt) <= Date.now();
    const result = await onSave({
      message: data.message,
      offline: false,
      opensAt: opensAtPassed ? null : data.opensAt,
      showCountdown: data.showCountdown,
    });
    if ("error" in result) {
      toast.error("Oops! Something went wrong.", {
        description: result.error.message ?? "Internal server error.",
      });

      return;
    }
    onClose();
    toast.success("Site is online", {
      description: "Visitors can use the site again.",
    });
  };

  const editButton = (
    <Button
      className="self-start sm:self-center"
      disabled={!canManage}
      onClick={() => setSheetMode("edit")}
      onFocus={preloadSiteStatusForm}
      onPointerEnter={preloadSiteStatusForm}
      size="sm"
      variant="outline"
    >
      <PencilIcon aria-hidden="true" />
      Edit
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Public site
          </p>
          <p className="text-2xl font-semibold tracking-tight text-balance">
            {data.offline
              ? "Visitors see the offline page"
              : "Everyone can visit"}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {data.offline
              ? "Staff can still browse the site and sign in."
              : "Switch to Offline to show visitors a message while you work."}
          </p>
        </div>
        <PowerSwitch
          canManage={canManage}
          offline={data.offline}
          onTurnOff={() => setSheetMode("turn_off")}
          onTurnOn={() => setConfirmOpen(true)}
        />
      </Card>

      <Card className="gap-0 divide-y p-0">
        <Row
          action={editButton}
          icon={<MessageSquareTextIcon />}
          label="Message"
        >
          {messageText ? (
            <div className="flex flex-col gap-2">
              <p className="line-clamp-2 text-pretty">{messageText}</p>
              <div className="flex flex-wrap gap-1.5">
                {data.message.map(item => (
                  <Badge key={item.languageCode} variant="secondary">
                    {item.languageCode.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            "No message yet. You write one when you turn the site off."
          )}
        </Row>
        <Row
          action={editButton}
          icon={<CalendarClockIcon />}
          label="Opening time"
        >
          <span className="inline-flex flex-wrap items-center gap-2">
            {data.opensAt
              ? format.dateTime(new Date(data.opensAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Not set"}
            {data.opensAt ? (
              <Badge variant="outline">
                {data.showCountdown ? "Countdown" : "Date only"}
              </Badge>
            ) : null}
          </span>
        </Row>
        <Row icon={<HistoryIcon />} label="Last switched">
          {data.changedAt ? (
            <>
              <DateFormat date={data.changedAt} />
              {data.changedBy ? ` by ${data.changedBy.name}` : null}
            </>
          ) : (
            "Never switched off"
          )}
        </Row>
        <div className="flex justify-end p-4 sm:px-5">
          <Dialog>
            <DialogTrigger render={<Button variant="ghost" />}>
              <EyeIcon aria-hidden="true" />
              Preview as visitor
            </DialogTrigger>
            <DialogContent className="gap-0 p-0 sm:max-w-2xl">
              <DialogHeader className="border-b p-4 pe-12">
                <DialogTitle>Offline page preview</DialogTitle>
                <DialogDescription>
                  What visitors see while the site is offline.
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted/40 flex justify-center px-4 py-10">
                <SiteOfflineContent
                  fetchedAt={fetchedAt}
                  headingLevel={2}
                  language={locale}
                  logo={logo}
                  status={{
                    message: data.message,
                    opensAt: data.opensAt,
                    serverNow: new Date(fetchedAt).toISOString(),
                    showCountdown: data.showCountdown,
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      <ConfirmActionAlertDialog
        description="Visitors will see the site again right away. Open offline pages reload on their own within a minute."
        icon={<PowerIcon />}
        onOpenChange={setConfirmOpen}
        onSubmit={turnOn}
        open={confirmOpen}
        submitVariant="default"
        textSubmit={
          <>
            <PowerIcon aria-hidden="true" />
            Turn on site
          </>
        }
        title="Turn the site on?"
      />

      <SiteStatusSheet
        canManage={canManage}
        data={data}
        mode={sheetMode}
        onOpenChange={setSheetMode}
        onSave={onSave}
      />
    </div>
  );
};
