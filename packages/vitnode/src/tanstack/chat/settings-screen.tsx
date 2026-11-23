import type { ChatRequestsFrom } from "@vitnode/api/lib/chat/const";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CHAT_REQUESTS_FROM } from "@vitnode/api/lib/chat/const";
import {
  BanIcon,
  EyeIcon,
  MailQuestionIcon,
  RotateCwIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  SETTINGS_ROW,
  SettingsGroup,
} from "@/views/auth/settings/settings-group";

import type { ChatSettingsView } from "./query";

import {
  blockedMembersQueryOptions,
  chatSettingsQueryOptions,
  setBlockRequest,
  updateChatSettingsRequest,
} from "./query";

const SettingsSkeleton = () => (
  <div className="flex flex-col gap-3 p-4" role="status">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);

const ChatPreferences = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.global.chat.settings");
  const tErrors = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const radioLabelId = React.useId();
  const receiptsLabelId = React.useId();
  const receiptsDescId = React.useId();
  const query = useQuery(chatSettingsQueryOptions(userId));
  const mutation = useMutation({
    mutationFn: updateChatSettingsRequest,
    onError: () => {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });
    },
    onSuccess: data => {
      queryClient.setQueryData(chatSettingsQueryOptions(userId).queryKey, data);
      toast.success(t("saved"), { description: t("saved_desc") });
    },
  });
  const current: ChatSettingsView | undefined = mutation.isPending
    ? mutation.variables
    : query.data;

  if (query.isPending) return <SettingsSkeleton />;
  if (query.isError || !current) {
    return (
      <Empty role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailQuestionIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <SettingsGroup title={t("title")}>
      <li className={`${SETTINGS_ROW} items-start`}>
        <MailQuestionIcon
          aria-hidden="true"
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium" id={radioLabelId}>
              {t("requests_from")}
            </span>
            <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("requests_from_desc")}
            </span>
          </div>
          <RadioGroup
            aria-busy={mutation.isPending}
            aria-labelledby={radioLabelId}
            disabled={mutation.isPending}
            onValueChange={value => {
              mutation.mutate({
                ...current,
                chatRequestsFrom: value as ChatRequestsFrom,
              });
            }}
            value={current.chatRequestsFrom}
          >
            {CHAT_REQUESTS_FROM.map(option => (
              <label className="flex items-start gap-2 text-sm" key={option}>
                <RadioGroupItem className="mt-0.5" value={option} />
                <span className="flex flex-col">
                  <span>{t(`from.${option}`)}</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    {t(`from.${option}_desc`)}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>
      </li>
      <li className={SETTINGS_ROW}>
        <EyeIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium" id={receiptsLabelId}>
            {t("receipts")}
          </span>
          <span
            className="text-muted-foreground text-sm leading-relaxed text-pretty"
            id={receiptsDescId}
          >
            {t("receipts_desc")}
          </span>
        </div>
        <Switch
          aria-busy={mutation.isPending}
          aria-describedby={receiptsDescId}
          aria-labelledby={receiptsLabelId}
          checked={current.showReadReceipts}
          disabled={mutation.isPending}
          onCheckedChange={next => {
            mutation.mutate({ ...current, showReadReceipts: next });
          }}
        />
      </li>
    </SettingsGroup>
  );
};

const BlockedMembers = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.global.chat.blocks");
  const queryClient = useQueryClient();
  const query = useQuery(blockedMembersQueryOptions(userId));
  const mutation = useMutation({
    mutationFn: async (blockedId: number) => {
      await setBlockRequest({ block: false, userId: blockedId });
    },
    onSuccess: async () => {
      toast.success(t("unblocked"), { description: t("unblocked_desc") });
      await queryClient.invalidateQueries({
        queryKey: blockedMembersQueryOptions(userId).queryKey,
      });
    },
  });

  return (
    <SettingsGroup title={t("title")}>
      {query.isPending ? (
        <li>
          <SettingsSkeleton />
        </li>
      ) : query.isError ? (
        <li className={SETTINGS_ROW} role="alert">
          <span className="text-muted-foreground flex-1 text-sm">
            {t("load_error")}
          </span>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </li>
      ) : query.data.items.length === 0 ? (
        <li className={SETTINGS_ROW}>
          <BanIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
          />
          <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("empty")}
          </span>
        </li>
      ) : (
        query.data.items.map(item => (
          <li className={SETTINGS_ROW} key={item.user.id}>
            <Avatar alt="" size={32} user={item.user} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {item.user.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {t("since")} <DateFormat date={item.blockedAt} />
              </span>
            </div>
            <Button
              disabled={mutation.isPending}
              isLoading={
                mutation.isPending && mutation.variables === item.user.id
              }
              onClick={() => {
                mutation.mutate(item.user.id);
              }}
              size="sm"
              variant="outline"
            >
              <UserRoundCheckIcon aria-hidden="true" />
              {t("unblock")}
            </Button>
          </li>
        ))
      )}
    </SettingsGroup>
  );
};

/** `/settings/chat`: who may send chat requests, read receipts and blocked members. */
export const ChatSettingsPanel = ({ userId }: { userId: number }) => (
  <div className="flex flex-col gap-6">
    <ChatPreferences userId={userId} />
    <BlockedMembers userId={userId} />
  </div>
);
