import { ContentComments } from "@vitnode/core/tanstack/comments";

import { usePostComments } from "./post-comments-data";

export const PostComments = ({
  articleAuthorIds,
  articleHref,
  articleId,
  articleTitle,
  canComment = true,
}: {
  articleAuthorIds: readonly number[];
  articleHref: string;
  articleId: number;
  articleTitle: string;
  /** Whether the article's categories let this reader comment. */
  canComment?: boolean;
}) => {
  const comments = usePostComments(articleId, canComment);

  return (
    <ContentComments
      anchorKey={comment => comment.slug}
      authorIds={articleAuthorIds}
      comments={comments}
      permalink={anchorId => `${articleHref}#${anchorId}`}
      shareTitle={articleTitle}
    />
  );
};
