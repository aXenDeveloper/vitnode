import { cn } from "cn";
import { CheckIcon, KeyRoundIcon, PlugZapIcon, PlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

import type { McpSettings } from "./mcp-query";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";
import { McpTokenItem } from "./mcp-token-item";

const CreateMcpTokenForm = React.lazy(async () =>
  import("./create-token-form").then(module => ({
    default: module.CreateMcpTokenForm,
  })),
);

export const McpContent = ({
  onChanged,
  settings,
}: {
  /** Refreshes the page's data after a token was created or revoked. */
  onChanged: () => Promise<void>;
  settings: McpSettings;
}) => {
  const t = useTranslations("core.auth.settings.mcp");
  const [open, setOpen] = React.useState(false);
  // The new token lives only in this state: it is shown once and never again.
  const [createdToken, setCreatedToken] = React.useState<null | string>(null);
  const hasTools = settings.plugins.some(plugin => plugin.tools.length > 0);

  const createButton = (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        disabled={!hasTools}
        onFocus={() => void import("./create-token-form")}
        onPointerEnter={() => void import("./create-token-form")}
        render={<Button />}
      >
        <PlusIcon aria-hidden="true" />
        {t("create.action")}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b pe-14">
          <SheetTitle>{t("create.title")}</SheetTitle>
          <SheetDescription className="leading-relaxed text-pretty">
            {t("create.desc")}
          </SheetDescription>
        </SheetHeader>
        <React.Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <CreateMcpTokenForm
            maxLifetimeDays={settings.maxLifetimeDays}
            onCreated={async created => {
              setOpen(false);
              setCreatedToken(created.token);
              await onChanged();
            }}
            plugins={settings.plugins}
          />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      <Dialog
        onOpenChange={next => {
          if (!next) setCreatedToken(null);
        }}
        open={createdToken !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("created.title")}</DialogTitle>
            <DialogDescription className="leading-relaxed text-pretty">
              {t("created.desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted flex items-center gap-2 rounded-md p-3">
            <code className="text-foreground min-w-0 flex-1 text-sm break-all">
              {createdToken}
            </code>
            <CopyButton
              aria-label={t("created.copy")}
              content={createdToken ?? ""}
              size="icon-sm"
              variant="ghost"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setCreatedToken(null);
              }}
            >
              <CheckIcon aria-hidden="true" />
              {t("created.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingsGroup footer={t("endpoint_desc")} title={t("endpoint")}>
        <li className={cn(SETTINGS_ROW, "justify-between")}>
          <code className="text-foreground min-w-0 truncate text-sm">
            {settings.endpoint}
          </code>
          <CopyButton
            aria-label={t("endpoint")}
            content={settings.endpoint}
            size="icon-sm"
            variant="ghost"
          />
        </li>
      </SettingsGroup>

      {!hasTools ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlugZapIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("no_tools.title")}</EmptyTitle>
            <EmptyDescription>{t("no_tools.desc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : settings.tokens.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{createButton}</EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex justify-end">{createButton}</div>
          <SettingsGroup title={t("tokens")}>
            {settings.tokens.map(token => (
              <McpTokenItem
                key={token.id}
                onRevoked={onChanged}
                token={token}
              />
            ))}
          </SettingsGroup>
        </>
      )}
    </>
  );
};
