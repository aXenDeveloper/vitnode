import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentThreadInput,
  ResolvedContentPublicApiConfig,
  ResolvedContentPublicWriteConfig,
  ResolvedContentThreadConfig,
} from "./types";

import { ContentEngineError } from "./errors";

export const CONTENT_THREAD_DEFAULT_MAX_DEPTH = 8;

export const CONTENT_THREAD_ABSOLUTE_MAX_DEPTH = 32;

export const DISABLED_CONTENT_THREAD: ResolvedContentThreadConfig = {
  enabled: false,
  maxDepth: 0,
  parentField: "",
  rootField: "",
};

const isToOneRelation = (
  field: ContentFieldDescriptor | undefined,
): field is Extract<ContentFieldDescriptor, { kind: "relation" }> =>
  field?.kind === "relation" && !field.multiple;

/**
 * Resolves `thread`: records of one content type that answer each other under
 * a shared root - forum replies under a topic, comments under a post.
 *
 * `parent` is a to-one self relation (`null` for a top-level reply), `root` a
 * to-one relation to the record the thread hangs off. Both are set on create
 * and never move, which is what keeps cycles impossible.
 */
export const resolveContentThread = (
  id: string,
  fields: ContentFieldMap,
  thread: ContentThreadInput | false | undefined,
  {
    localized,
    publicApi,
    publicWrite,
  }: {
    localized: boolean;
    publicApi: ResolvedContentPublicApiConfig;
    publicWrite: ResolvedContentPublicWriteConfig;
  },
): ResolvedContentThreadConfig => {
  if (thread === undefined || thread === false) return DISABLED_CONTENT_THREAD;

  if (typeof thread !== "object" || thread === null) {
    throw new ContentEngineError(
      "thread is `{ parent, root, maxDepth? }` or `false`.",
      { contentTypeId: id },
    );
  }

  const unknown = Object.keys(thread).find(
    key => key !== "parent" && key !== "root" && key !== "maxDepth",
  );
  if (unknown !== undefined) {
    throw new ContentEngineError(
      `thread.${unknown} is not an option. thread accepts: parent, root, maxDepth.`,
      { contentTypeId: id },
    );
  }

  const parent = fields[thread.parent];
  if (!isToOneRelation(parent) || !parent.self) {
    throw new ContentEngineError(
      `thread.parent "${thread.parent}" must be a to-one \`field.relation({ self: true, nullable: true })\` - the reply being answered.`,
      { contentTypeId: id },
    );
  }
  if (!parent.nullable) {
    throw new ContentEngineError(
      `thread.parent "${thread.parent}" must be nullable: a top-level reply answers nobody.`,
      { contentTypeId: id },
    );
  }

  const root = fields[thread.root];
  if (!isToOneRelation(root) || root.self || !root.required) {
    throw new ContentEngineError(
      `thread.root "${thread.root}" must be a required, to-one \`field.relation({ target })\` to another content type - the record the thread belongs to.`,
      { contentTypeId: id },
    );
  }

  const maxDepth = thread.maxDepth ?? CONTENT_THREAD_DEFAULT_MAX_DEPTH;
  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > CONTENT_THREAD_ABSOLUTE_MAX_DEPTH
  ) {
    throw new ContentEngineError(
      `thread.maxDepth must be a whole number from 1 to ${CONTENT_THREAD_ABSOLUTE_MAX_DEPTH}.`,
      { contentTypeId: id },
    );
  }

  if (localized) {
    throw new ContentEngineError(
      "thread is not available on a localized content type yet: replies are written in one language.",
      { contentTypeId: id },
    );
  }

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "thread needs `publicApi`: the thread route lives beside the public read routes.",
      { contentTypeId: id },
    );
  }
  for (const name of [thread.parent, thread.root]) {
    if (!(publicApi.fields as readonly string[]).includes(name)) {
      throw new ContentEngineError(
        `thread uses "${name}", so list it in \`publicApi.fields\` - a reader rebuilds the tree from it.`,
        { contentTypeId: id },
      );
    }
  }

  const moved = [thread.parent, thread.root].find(name =>
    publicWrite.update.fields.includes(name),
  );
  if (moved !== undefined) {
    throw new ContentEngineError(
      `publicWrite.update.fields includes "${moved}". A reply is placed in its thread when it is written and stays there - leave it out of \`update\`.`,
      { contentTypeId: id },
    );
  }

  return {
    enabled: true,
    maxDepth,
    parentField: thread.parent,
    rootField: thread.root,
  };
};
