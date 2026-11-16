import type { AbstractIntlMessages } from "use-intl";

import { deepMerge } from "@vitnode/api/lib/i18n/deep-merge";

export const mergeEditorMessages = (
  page: AbstractIntlMessages,
  editor: AbstractIntlMessages,
): AbstractIntlMessages => deepMerge(page, editor);
