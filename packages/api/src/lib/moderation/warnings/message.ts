import type { MultiLangValue } from "@/lib/helpers/multi-lang";
import type { WarningMessage } from "@/lib/moderation/warnings";

import { richTextToPlainText } from "@/content/rich-text/plain-text";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

export const warningMessagePreview = (
  message: WarningMessage,
): MultiLangValue =>
  message.map(({ languageCode, value }) => ({
    languageCode,
    value: richTextToPlainText(value).slice(0, WARNING_LIMITS.messageMaxLength),
  }));
