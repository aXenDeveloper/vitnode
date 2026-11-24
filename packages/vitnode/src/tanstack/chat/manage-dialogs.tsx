import type { ContentPublicPerson } from "@vitnode/api/content/public-person";
import type { ChatKeyGrant } from "@vitnode/api/lib/chat/e2e";
import type { ChatDetails } from "@vitnode/api/lib/chat/types";

import { useQueryClient } from "@tanstack/react-query";
import { CHAT_LIMITS } from "@vitnode/api/lib/chat/const";
import { UserPlusIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useChatErrorToast } from "./composer";
import { wrapChatKey } from "./e2e/crypto";
import { ChatPeoplePicker } from "./people-picker";
import {
  addChatMembersRequest,
  ChatRequestError,
  fetchPublicChatKeys,
  invalidateChatOverview,
  updateChatRequest,
} from "./query";

/** Adds people to a group chat. */
export const AddPeopleDialog = ({
  chat,
  chatKey,
  onClose,
  userId,
}: {
  chat: ChatDetails;
  /** Encrypted chats: the key to share with the people added. */
  chatKey?: CryptoKey | null;
  onClose: () => void;
  userId: number;
}) => {
  const t = useTranslations("core.global.chat.add_people");
  const queryClient = useQueryClient();
  const showError = useChatErrorToast();
  const [people, setPeople] = React.useState<ContentPublicPerson[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>
        <ChatPeoplePicker
          exclude={chat.members.map(member => member.user.id)}
          max={CHAT_LIMITS.maxGroupSize - chat.membersCount}
          onChange={setPeople}
          userId={userId}
          value={people}
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <Button
            disabled={people.length === 0}
            isLoading={isSaving}
            onClick={() =>
              void (async () => {
                setIsSaving(true);
                try {
                  const userIds = people.map(person => person.id);
                  let keys: ChatKeyGrant[] | undefined;
                  if (chat.encrypted) {
                    if (!chatKey)
                      throw new ChatRequestError(403, "not_allowed");
                    const found = await fetchPublicChatKeys(userIds);
                    if (found.length !== userIds.length) {
                      throw new ChatRequestError(403, "recipient_no_passcode");
                    }
                    keys = await Promise.all(
                      found.map(async key => ({
                        keyVersion: key.keyVersion,
                        userId: key.userId,
                        wrappedKey: await wrapChatKey(chatKey, key.publicKey),
                      })),
                    );
                  }
                  await addChatMembersRequest({
                    chatId: chat.id,
                    keys,
                    userIds,
                  });
                  toast.success(t("done"), {
                    description: t("done_desc", { count: people.length }),
                  });
                  await invalidateChatOverview(queryClient, userId, chat.id);
                  onClose();
                } catch (error) {
                  showError(error);
                } finally {
                  setIsSaving(false);
                }
              })()
            }
          >
            <UserPlusIcon aria-hidden="true" />
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Renames a group chat (host only). */
export const RenameChatDialog = ({
  chat,
  onClose,
  userId,
}: {
  chat: ChatDetails;
  onClose: () => void;
  userId: number;
}) => {
  const t = useTranslations("core.global.chat.rename");
  const queryClient = useQueryClient();
  const showError = useChatErrorToast();
  const formSchema = z.object({
    title: z
      .string()
      .max(CHAT_LIMITS.titleMaxLength)
      .default(chat.title ?? ""),
  });
  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    try {
      await updateChatRequest({
        chatId: chat.id,
        title: values.title.trim() || null,
      });
      toast.success(t("done"), { description: t("done_desc") });
      await invalidateChatOverview(queryClient, userId, chat.id);
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>
        <AutoForm
          fields={[
            {
              component: props => (
                <AutoFormInput {...props} label={t("field")} />
              ),
              id: "title",
            },
          ]}
          formSchema={formSchema}
          onSubmit={onSubmit}
          submitButtonProps={{ children: t("submit") }}
        />
      </DialogContent>
    </Dialog>
  );
};
