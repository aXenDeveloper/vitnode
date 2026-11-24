import type { ContentPublicPerson } from "@vitnode/api/content/public-person";
import type { ChatKeyGrant } from "@vitnode/api/lib/chat/e2e";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CHAT_LIMITS } from "@vitnode/api/lib/chat/const";
import {
  ArrowLeftIcon,
  LockIcon,
  LockKeyholeIcon,
  SendHorizontalIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { ChatSessionUser } from "./chat-view";

import { useChatErrorToast } from "./composer";
import { encryptChatMessage, generateChatKey, wrapChatKey } from "./e2e/crypto";
import { useChatE2E } from "./e2e/hooks";
import { e2eStore } from "./e2e/store";
import { ChatUnlockPanel } from "./e2e/unlock-panel";

const subscribeToNothing = () => () => {};

const LazyPasscodeDialog = React.lazy(async () => ({
  default: (await import("./e2e/passcode-dialog")).PasscodeDialog,
}));
import { ChatPeoplePicker } from "./people-picker";
import {
  canChatQueryOptions,
  chatRoot,
  chatStateQueryOptions,
  fetchPublicChatKeys,
  invalidateChatOverview,
  startChatRequest,
} from "./query";

/**
 * Starts a chat: pick people, name the group when there are several, write
 * the first message. Opens the existing chat when there is one.
 */
export const NewChat = ({
  initialEncrypted,
  initialPeople = [],
  me,
  onBack,
  onCreated,
}: {
  /** Start with encryption on (it is always on when a role requires it). */
  initialEncrypted?: boolean;
  initialPeople?: ContentPublicPerson[];
  me: ChatSessionUser;
  onBack?: () => void;
  onCreated: (chatId: number) => void;
}) => {
  const t = useTranslations("core.global.chat.new");
  const queryClient = useQueryClient();
  const showError = useChatErrorToast();
  const titleId = React.useId();
  const bodyId = React.useId();
  const encryptId = React.useId();
  const tSetup = useTranslations("core.global.chat.e2e.unlock");
  const tE2E = useTranslations("core.global.chat.e2e.new");
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [people, setPeople] = React.useState(initialPeople);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const single = people.length === 1 ? people[0] : undefined;
  const canChat = useQuery({
    ...canChatQueryOptions({ targetId: single?.id ?? 0, userId: me.id }),
    enabled: !!single,
  });
  const state = useQuery(chatStateQueryOptions(me.id));
  const groups = state.data?.groups ?? true;
  const e2e = useChatE2E(me.id);
  // Encryption state lives in the browser (cached state, unlocked keys): the
  // server renders without it, so show it only once hydrated.
  const hydrated = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const forced = hydrated && (state.data?.passcode.required ?? false);
  const [encryptedChoice, setEncryptedChoice] = React.useState(
    initialEncrypted ?? false,
  );
  const encrypted = forced || encryptedChoice;
  const peopleIds = people.map(person => person.id);
  const publicKeys = useQuery({
    enabled: encrypted && peopleIds.length > 0,
    queryFn: async () => await fetchPublicChatKeys([me.id, ...peopleIds]),
    queryKey: [...chatRoot(me.id), "public-keys", me.id, ...peopleIds] as const,
    retry: false,
  });
  const withKeys = new Set(publicKeys.data?.map(key => key.userId));
  const missing =
    encrypted && publicKeys.data
      ? people.filter(person => !withKeys.has(person.id))
      : [];
  const isGroup = people.length > 1;
  const trimmed = body.trim();
  const blocked = !!single && canChat.data?.allowed === false;
  const ready =
    people.length > 0 &&
    !blocked &&
    (isGroup || trimmed.length > 0) &&
    body.length <= CHAT_LIMITS.messageMaxLength &&
    (!encrypted ||
      (e2e.status === "unlocked" && !!publicKeys.data && missing.length === 0));

  const submit = async () => {
    if (!ready) return;
    setIsSaving(true);
    try {
      let chatKey: CryptoKey | null = null;
      let sealed: null | { body: string; commitment: string } = null;
      let keys: ChatKeyGrant[] | undefined;
      if (encrypted) {
        const newKey = await generateChatKey();
        chatKey = newKey;
        keys = await Promise.all(
          (publicKeys.data ?? []).map(async key => ({
            keyVersion: key.keyVersion,
            userId: key.userId,
            wrappedKey: await wrapChatKey(newKey, key.publicKey),
          })),
        );
        sealed = trimmed ? await encryptChatMessage(newKey, trimmed) : null;
      }
      const result = await startChatRequest({
        body: sealed?.body ?? (trimmed || undefined),
        commitment: sealed?.commitment,
        encrypted: encrypted || undefined,
        keys,
        title: isGroup ? title.trim() || undefined : undefined,
        userIds: peopleIds,
      });
      const ownVersion = publicKeys.data?.find(
        key => key.userId === me.id,
      )?.keyVersion;
      if (chatKey && result.created && ownVersion !== undefined) {
        e2eStore.setChatKey(result.chatId, ownVersion, chatKey);
      }
      await invalidateChatOverview(queryClient, me.id, result.chatId);
      if (single && canChat.data?.asRequest) {
        toast.success(t("request_sent"), {
          description: t("request_sent_desc", { name: single.name }),
        });
      }
      onCreated(result.chatId);
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <header className="flex items-center gap-2 border-b p-2">
        {onBack ? (
          <Button
            aria-label={t("back")}
            onClick={onBack}
            size="icon-sm"
            variant="ghost"
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
        ) : null}
        <h2 className="text-sm font-semibold text-balance">{t("title")}</h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <ChatPeoplePicker
          max={groups ? CHAT_LIMITS.maxGroupSize - 1 : 1}
          onChange={setPeople}
          userId={me.id}
          value={people}
        />
        {blocked ? (
          <p className="text-destructive text-sm" role="alert">
            {t("unavailable", { name: single.name })}
          </p>
        ) : single && canChat.data?.asRequest ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("as_request", {
              count: CHAT_LIMITS.pendingMessages,
              name: single.name,
            })}
          </p>
        ) : null}
        {hydrated ? (
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <LockIcon
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Label htmlFor={encryptId}>{tE2E("toggle")}</Label>
              <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {forced ? tE2E("forced") : tE2E("toggle_desc")}
              </p>
            </div>
            <Switch
              checked={encrypted}
              disabled={forced}
              id={encryptId}
              onCheckedChange={value => {
                setEncryptedChoice(value);
              }}
            />
          </div>
        ) : null}
        {encrypted && e2e.status === "none" ? (
          <div className="flex flex-col items-start gap-2" role="alert">
            <p className="text-sm leading-relaxed text-pretty">
              {tE2E("need_setup")}
            </p>
            <Button
              onClick={() => {
                setSetupOpen(true);
              }}
              size="sm"
              type="button"
            >
              <LockKeyholeIcon aria-hidden="true" />
              {tSetup("setup")}
            </Button>
          </div>
        ) : null}
        {encrypted && e2e.status === "locked" ? (
          <ChatUnlockPanel userId={me.id} />
        ) : null}
        {missing.length > 0 ? (
          <p className="text-destructive text-sm" role="alert">
            {tE2E("missing", {
              count: missing.length,
              names: missing.map(person => person.name).join(", "),
            })}
          </p>
        ) : null}
        {isGroup ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={titleId}>{t("group_name")}</Label>
            <Input
              id={titleId}
              maxLength={CHAT_LIMITS.titleMaxLength}
              onChange={event => {
                setTitle(event.target.value);
              }}
              placeholder={t("group_name_placeholder")}
              value={title}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor={bodyId}>
            {isGroup ? t("message_optional") : t("message")}
          </Label>
          <Textarea
            id={bodyId}
            maxLength={CHAT_LIMITS.messageMaxLength}
            onChange={event => {
              setBody(event.target.value);
            }}
            placeholder={t("message_placeholder")}
            rows={4}
            value={body}
          />
        </div>
      </div>
      <div className="flex justify-end border-t p-2">
        <Button disabled={!ready} isLoading={isSaving} type="submit">
          <SendHorizontalIcon aria-hidden="true" />
          {isGroup ? t("start_group") : t("send")}
        </Button>
      </div>
      {setupOpen ? (
        <React.Suspense fallback={null}>
          <LazyPasscodeDialog
            mode="setup"
            onClose={() => {
              setSetupOpen(false);
            }}
            userId={me.id}
          />
        </React.Suspense>
      ) : null}
    </form>
  );
};
