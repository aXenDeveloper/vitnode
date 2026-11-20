import type {
  ContentReactionsInput,
  ResolvedContentPublicApiConfig,
  ResolvedContentReactionsConfig,
} from "./types";

import { ContentEngineError } from "./errors";

const DISABLED: ResolvedContentReactionsConfig = {
  enabled: false,
  reputation: false,
};

const REACTION_OPTION_KEYS = new Set(["reputation"]);

/**
 * Resolves `reactions` on a content type. Which reactions, how many per item
 * and how many a day are role settings in the AdminCP, so the only options
 * are about the content itself.
 */
export const resolveReactions = (
  id: string,
  reactions: ContentReactionsInput | undefined,
  {
    authorField,
    publicApi,
  }: {
    /** The search author field or the public write owner, if any. */
    authorField: null | string;
    publicApi: ResolvedContentPublicApiConfig;
  },
): ResolvedContentReactionsConfig => {
  if (reactions === undefined || reactions === false) return DISABLED;

  if (
    reactions !== true &&
    (typeof reactions !== "object" || reactions === null)
  ) {
    throw new ContentEngineError(
      "reactions is `true` or an options object with `reputation`.",
      { contentTypeId: id },
    );
  }

  const options = reactions === true ? {} : reactions;
  const unknownKey = Object.keys(options).find(
    key => !REACTION_OPTION_KEYS.has(key),
  );
  if (unknownKey) {
    throw new ContentEngineError(
      `reactions.${unknownKey} is not an option. Use \`reputation\`; which reactions a member may use, how many per item, how many a day and whether authors may react to their own content are role settings in the AdminCP.`,
      { contentTypeId: id },
    );
  }

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "reactions needs `publicApi`. Members react to what they can read, and the public API is what decides that.",
      { contentTypeId: id },
    );
  }

  return {
    enabled: true,
    reputation: authorField !== null && options.reputation !== false,
  };
};
