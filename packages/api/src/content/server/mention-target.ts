import type { MentionTargetDefinition } from "../../lib/mentions/targets";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { contentDefinitionOf } from "./model";
import { contentNotificationAccess } from "./notifications/access";

/** The rich-text fields whose `@mentions` notify - every one without `mentions: false`. */
export const contentMentionFields = (
  definition: AnyContentTypeDefinition,
): string[] =>
  Object.entries(definition.fields).flatMap(([name, field]) =>
    field.kind === "richText" && field.mentions !== false ? [name] : [],
  );

/**
 * The mention target of a content type with mention fields: a member hears
 * about a mention while the record (and its thread root) is public and the
 * type's access rules let them read it.
 */
export const contentMentionTarget = (
  model: AnyContentModel,
): MentionTargetDefinition => {
  const definition = contentDefinitionOf(model);
  const access = contentNotificationAccess({
    content: definition,
    policy: "content",
  });

  return {
    access: async ({ c, id, rootId, userIds }) =>
      await access({
        c,
        data: { contentId: id, contentTypeId: definition.id, rootId },
        subject: null,
        userIds,
      }),
    type: definition.id,
  };
};
