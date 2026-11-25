import { cn } from "cn";
import { BotIcon, UnplugIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { McpConnection } from "./connected-apps-query";

import { SETTINGS_ROW } from "../settings-group";

/** Disconnects one app; resolves `true` once it is gone. */
export type DisconnectConnectedApp = (id: number) => Promise<boolean>;

/** The client's own website, when it named a plain `http(s)` one. */
const websiteOf = (uri: null | string): null | URL => {
  if (!uri) return null;

  try {
    const url = new URL(uri);

    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

const DisconnectButton = ({
  connection,
  onDisconnect,
}: {
  connection: McpConnection;
  onDisconnect: DisconnectConnectedApp;
}) => {
  const t = useTranslations("core.auth.settings.connected_apps.disconnect");
  const name = connection.client.name;

  return (
    <ConfirmActionAlertDialog
      description={t("desc", { name })}
      icon={<UnplugIcon />}
      onSubmit={async ({ onClose }) => {
        const isDone = await onDisconnect(connection.id);

        if (!isDone) {
          toast.error(t("error"), { description: t("error_desc") });

          return;
        }

        toast.success(t("success"), {
          description: t("success_desc", { name }),
        });
        onClose();
      }}
      textSubmit={
        <>
          <UnplugIcon aria-hidden="true" />
          {t("confirm")}
        </>
      }
      title={t("title", { name })}
    >
      <Button
        aria-label={t("aria", { name })}
        className="shrink-0"
        size="sm"
        variant="outline"
      >
        <UnplugIcon aria-hidden="true" />
        {t("action")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};

export const ConnectionItem = ({
  connection,
  onDisconnect,
}: {
  connection: McpConnection;
  onDisconnect: DisconnectConnectedApp;
}) => {
  const t = useTranslations("core.auth.settings.connected_apps");
  const website = websiteOf(connection.client.uri);

  const facts = [
    {
      label: t("connected"),
      value: <DateFormat date={connection.createdAt} />,
    },
    {
      label: t("last_used"),
      value: <DateFormat date={connection.lastUsedAt} />,
    },
    {
      label: t("access"),
      value: (
        <span className="flex flex-wrap gap-1">
          {connection.scopes.map(scope => (
            <Badge
              key={scope}
              variant={scope === "write" ? "default" : "secondary"}
            >
              {t(`scopes.${scope}`)}
            </Badge>
          ))}
        </span>
      ),
    },
  ];

  return (
    <li className={cn(SETTINGS_ROW, "flex-wrap items-start sm:flex-nowrap")}>
      <div className="bg-muted/60 text-muted-foreground ring-foreground/10 flex size-10 shrink-0 items-center justify-center rounded-md ring-1">
        <BotIcon aria-hidden="true" className="size-4.5" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-sm font-medium wrap-anywhere">
            {connection.client.name}
          </span>
          {website ? (
            <a
              className="text-muted-foreground w-fit text-sm wrap-anywhere underline-offset-4 hover:underline"
              href={website.href}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              {website.host}
            </a>
          ) : null}
        </div>
        <dl className="flex flex-col gap-1 text-sm sm:grid sm:grid-cols-3 sm:gap-x-6">
          {facts.map(({ label, value }) => (
            <div
              className="flex min-w-0 items-center gap-3 sm:flex-col sm:items-start sm:gap-0.5"
              key={label}
            >
              <dt className="text-muted-foreground w-24 shrink-0 sm:w-auto">
                {label}
              </dt>
              <dd className="text-foreground min-w-0 wrap-anywhere">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex w-full justify-end sm:w-auto">
        <DisconnectButton connection={connection} onDisconnect={onDisconnect} />
      </div>
    </li>
  );
};
