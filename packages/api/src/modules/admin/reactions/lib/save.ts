import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import { core_reactions_roles } from "@/database/reactions";
import { parseEmojiIcon, serializeEmojiIcon } from "@/lib/emoji-icon";
import { REACTION_WORDS } from "@/lib/reactions/const";
import { saveLanguageWords } from "@/lib/save-language-words";

import type { ReactionBody } from "../reactions.schema";

/** The look columns of a reaction body, or an error code when they do not fit its kind. */
export const lookOf = (
  body: Pick<ReactionBody, "fileId" | "icon" | "kind" | "posterFileId">,
):
  | { error: "invalid_look" }
  | {
      fileId: null | number;
      icon: null | string;
      posterFileId: null | number;
    } => {
  if (body.kind === "image") {
    if (body.fileId === null) return { error: "invalid_look" };

    return {
      fileId: body.fileId,
      icon: null,
      posterFileId: body.posterFileId,
    };
  }

  const parsed = parseEmojiIcon(body.icon ?? undefined);
  if (!parsed || parsed.type !== body.kind) return { error: "invalid_look" };

  return { fileId: null, icon: serializeEmojiIcon(parsed), posterFileId: null };
};

/** Replaces a reaction's role rules inside `tx`. */
export const replaceReactionRoles = async (
  tx: ContentDatabase,
  reactionId: number,
  roles: ReactionBody["roles"],
): Promise<void> => {
  await tx
    .delete(core_reactions_roles)
    .where(eq(core_reactions_roles.reactionId, reactionId));
  const unique = new Map(roles.map(role => [role.roleId, role.dailyLimit]));
  if (unique.size === 0) return;

  await tx.insert(core_reactions_roles).values(
    [...unique].map(([roleId, dailyLimit]) => ({
      dailyLimit,
      reactionId,
      roleId,
    })),
  );
};

export const saveReactionTitle = async (
  c: Context,
  reactionId: number,
  title: ReactionBody["title"],
): Promise<void> => {
  await saveLanguageWords(c, {
    ...REACTION_WORDS,
    itemId: reactionId,
    values: title,
    variable: "title",
  });
};
