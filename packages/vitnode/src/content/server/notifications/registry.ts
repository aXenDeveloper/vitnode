import type { AnyContentTypeDefinition } from "../../types";
import type { RegisteredContentModel } from "../model";
import type {
  ContentNotificationsConfig,
  ContentNotificationTrigger,
  ResolvedContentNotificationRule,
} from "./define";

import { ContentEngineError } from "../../errors";
import { findContentModel } from "../model";

/** One rule with the configuration and plugin that registered it. */
export interface RegisteredContentNotificationRule {
  config: ContentNotificationsConfig;
  pluginId: string;
  rule: ResolvedContentNotificationRule;
}

/** Every content notification rule of the installation, read as `c.get("core").contentNotifications`. */
export interface ContentNotificationRegistry {
  /** The rule whose notification type has this id. */
  get: (typeId: string) => RegisteredContentNotificationRule | undefined;
  /** Whether a delete of this content type has notifications to clean up. */
  hasDependents: (contentTypeId: string) => boolean;
  list: RegisteredContentNotificationRule[];
  /** The rules a trigger on this content type runs. */
  rulesFor: (
    contentTypeId: string,
    trigger: ContentNotificationTrigger,
  ) => RegisteredContentNotificationRule[];
}

const threadRootOf = (
  definition: AnyContentTypeDefinition,
): AnyContentTypeDefinition | null => {
  if (!definition.thread.enabled) return null;
  const field = definition.fields[definition.thread.rootField];

  return field?.kind === "relation" ? field.target() : null;
};

/**
 * Validates every plugin's `contentNotifications` together, once at boot:
 * the content types must be registered models, and a `threadReply` rule's
 * `root` must be the type its `thread.root` points at.
 *
 * @throws {ContentEngineError} For an unregistered content type or a root
 * that does not match the thread.
 */
export const createContentNotificationRegistry = (
  entries: readonly { config: ContentNotificationsConfig; pluginId: string }[],
  contentModels: readonly RegisteredContentModel[],
): ContentNotificationRegistry => {
  const list: RegisteredContentNotificationRule[] = [];

  for (const { config, pluginId } of entries) {
    const { content, root } = config;
    const fail = (message: string): never => {
      throw new ContentEngineError(
        `Content notifications of "${pluginId}": ${message}`,
        { contentTypeId: content.id },
      );
    };

    if (!findContentModel(contentModels, content.id)) {
      fail(
        `"${content.id}" has no registered model. Register it with \`buildContentAdminModule\` in a plugin.`,
      );
    }
    if (root && !findContentModel(contentModels, root.id)) {
      fail(`the root "${root.id}" has no registered model.`);
    }

    const threadRoot = threadRootOf(content);
    for (const rule of config.rules) {
      if (rule.kind === "threadReply" && threadRoot?.id !== root?.id) {
        fail(
          `rule "${rule.key}" names "${root?.id}" as its root, but \`thread.root\` points at "${threadRoot?.id}".`,
        );
      }
      list.push({ config, pluginId, rule });
    }
  }

  const byType = new Map(list.map(entry => [entry.rule.type.id, entry]));
  const dependents = new Set(
    list.flatMap(({ config }) =>
      config.root ? [config.content.id, config.root.id] : [config.content.id],
    ),
  );

  return {
    get: typeId => byType.get(typeId),
    hasDependents: contentTypeId => dependents.has(contentTypeId),
    list,
    rulesFor: (contentTypeId, trigger) =>
      list.filter(
        entry =>
          entry.config.content.id === contentTypeId &&
          entry.rule.on === trigger,
      ),
  };
};
