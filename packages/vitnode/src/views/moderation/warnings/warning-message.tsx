import { cn } from "cn";
import { useLocale } from "use-intl";

import type { RichTextDocument } from "@/content/rich-text/document";
import type { WarningMessage } from "@/lib/moderation/warnings";

import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { isRichTextEmpty } from "@/content/rich-text/document";
import { findLangValue, pickLangCodeWhere } from "@/lib/helpers/multi-lang";

export const pickWarningMessage = (
  message: WarningMessage,
  locale: string,
): null | RichTextDocument =>
  findLangValue(
    message,
    pickLangCodeWhere({
      isFilledIn: code => !isRichTextEmpty(findLangValue(message, code)),
      languageCodes: message.map(item => item.languageCode),
      locale,
    }),
  ) ?? null;

export const WarningMessageContent = ({
  className,
  message,
}: {
  className?: string;
  message: WarningMessage;
}) => {
  const locale = useLocale();

  return (
    <RichTextContent
      className={cn("text-sm leading-relaxed break-words", className)}
      content={pickWarningMessage(message, locale)}
    />
  );
};

export const WarningNoteContent = ({
  className,
  note,
}: {
  className?: string;
  note: RichTextDocument;
}) => (
  <RichTextContent
    className={cn("text-sm leading-relaxed break-words", className)}
    content={note}
  />
);
