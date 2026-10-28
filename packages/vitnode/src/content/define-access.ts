import type { ContentAccessScopeInput } from "./access/policy";
import type { ContentFieldMap } from "./types";

import {
  DISABLED_CONTENT_ACCESS_SCOPE,
  resolveContentAccessScopeInput,
} from "./access/policy";
import { ContentEngineError } from "./errors";

/**
 * The `access` option of a content type, in one of two shapes:
 *
 * - `{ scope: true | { defaults } }` - the content type's records are access
 *   scopes themselves (a blog category): each gets its own view, read, comment
 *   and download rules in the AdminCP.
 * - `{ from: "categoryId" }` - a relation field pointing at a scope content
 *   type. A record is readable only when **every** scope it points at allows
 *   the action.
 */
export type ContentAccessInput<TField extends string = string> =
  | { from: TField }
  | { scope: ContentAccessScopeInput | true };

export interface ResolvedContentTypeAccess {
  /** The relation field whose targets are this type's scopes, or `null`. */
  from: null | string;
  scope: typeof DISABLED_CONTENT_ACCESS_SCOPE;
}

export const DISABLED_CONTENT_TYPE_ACCESS: ResolvedContentTypeAccess = {
  from: null,
  scope: DISABLED_CONTENT_ACCESS_SCOPE,
};

export const resolveContentTypeAccess = (
  id: string,
  fields: ContentFieldMap,
  access: ContentAccessInput | false | undefined,
): ResolvedContentTypeAccess => {
  if (access === undefined || access === false) {
    return DISABLED_CONTENT_TYPE_ACCESS;
  }

  const fail = (message: string): never => {
    throw new ContentEngineError(message, { contentTypeId: id });
  };

  if (typeof access !== "object" || access === null || Array.isArray(access)) {
    return fail(
      'access is `{ scope: true }`, `{ scope: { defaults } }` or `{ from: "<relation field>" }`.',
    );
  }

  const keys = Object.keys(access);
  if (keys.length !== 1 || (keys[0] !== "scope" && keys[0] !== "from")) {
    return fail(
      'access takes exactly one of `scope` (records of this type are access scopes) or `from` (a relation to a scope content type).',
    );
  }

  if ("scope" in access) {
    try {
      return {
        from: null,
        scope: resolveContentAccessScopeInput(access.scope),
      };
    } catch (error) {
      return fail((error as Error).message.replace(/^access/, "access.scope"));
    }
  }

  const name = access.from;
  const field = fields[name];
  if (field?.kind !== "relation") {
    return fail(
      `access.from names "${String(name)}", which is not a relation field of this content type.`,
    );
  }
  if (field.localized === true) {
    return fail(
      `access.from names the localized relation "${name}". Access scopes are shared by every language - use a shared relation.`,
    );
  }

  return { from: name, scope: DISABLED_CONTENT_ACCESS_SCOPE };
};
