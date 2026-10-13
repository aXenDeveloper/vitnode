import { useTranslations } from "use-intl";

import {
  contentEntityKey,
  contentTypeName,
  humanizeFieldName,
} from "@/content/admin/labels";

const baseKey = (pluginId: string, contentTypeId: string) =>
  `${pluginId}.content.${contentEntityKey(contentTypeId)}`;

/** The plugin label key whose namespace also holds the type's field names. */
export const approvalTypeLabelKey = (subject: {
  contentTypeId: string;
  pluginId: string;
}): string => `${baseKey(subject.pluginId, subject.contentTypeId)}.label`;

/** Translates a content type's noun and its field names, falling back to readable ids. */
export const useApprovalLabels = () => {
  const tRoot = useTranslations();
  const has = (key: string) => tRoot.has(key as never);

  return {
    field: (
      subject: { contentTypeId: string; pluginId: string },
      name: string,
    ): string => {
      const key = `${baseKey(subject.pluginId, subject.contentTypeId)}.fields.${name}`;

      return has(key) ? tRoot(key as never) : humanizeFieldName(name);
    },
    type: (subject: { contentTypeId: string; pluginId: string }): string => {
      const key = approvalTypeLabelKey(subject);

      return has(key)
        ? tRoot(key as never, { count: 1 } as never)
        : contentTypeName(subject.contentTypeId);
    },
  };
};
