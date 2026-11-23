import type { RichTextMention } from "@vitnode/api/content/rich-text/mentions";

import { useQuery } from "@tanstack/react-query";

import { mentionedUserQueryOptions } from "@/views/mentions/mentions-query";

import { UserPreview } from "../user-preview";

/**
 * An `@mention` in rendered rich text: a link to the member's profile with
 * the preview card. It shows the stored snapshot first and then the member's
 * current name, so renames never break it. A deleted member stays as plain
 * text; a failed lookup keeps the snapshot.
 */
export const RichTextMentionLink = ({
  mention,
}: {
  mention: RichTextMention;
}) => {
  const { data, isSuccess } = useQuery(mentionedUserQueryOptions(mention.id));

  if (isSuccess && data === null) {
    return (
      <span className="mention text-muted-foreground" data-type="mention">
        @{mention.label}
      </span>
    );
  }

  const name = data?.name ?? mention.label;
  const nameCode = data?.nameCode ?? mention.nameCode;

  if (!nameCode) {
    return (
      <span className="mention" data-type="mention">
        @{name}
      </span>
    );
  }

  return (
    <UserPreview className="mention" nameCode={nameCode}>
      @{name}
    </UserPreview>
  );
};
