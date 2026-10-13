import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentPublicWriteConfig,
  ResolvedContentPublicApiConfig,
  ResolvedContentPublicWriteConfig,
} from "./types";

import {
  CONTENT_PUBLIC_WRITABLE_KINDS,
  CONTENT_PUBLICATION_STATUSES,
} from "./const";
import {
  editorialFields,
  publicationFields,
  systemFields,
  visibilityFields,
} from "./define-shared";
import { ContentEngineError } from "./errors";
import { splitContentFieldPath } from "./paths";

const writableKinds: ReadonlySet<string> = new Set(
  CONTENT_PUBLIC_WRITABLE_KINDS,
);

const reservedNames: ReadonlySet<string> = new Set([
  ...systemFields,
  ...publicationFields,
  ...editorialFields,
  ...visibilityFields,
]);

export const DISABLED_PUBLIC_WRITE: ResolvedContentPublicWriteConfig<
  string,
  string,
  false,
  false
> = {
  create: { captcha: false, enabled: false, fields: [], status: "draft" },
  enabled: false,
  ownerField: null,
  update: { enabled: false, fields: [], own: false },
};

const UNWRITABLE_REASON: Record<string, string> = {
  blocks:
    "A block zone is a whole document of nested values, each with its own rules.",
  file: "A file id names somebody's upload, and the upload routes are AdminCP-only.",
  group:
    "A group is several columns behind one name, so listing it would make a leaf added later writable too.",
  repeatable:
    "A repeatable is a set of child rows, which a strict field allowlist cannot describe.",
  user: "A user id names a person. Ownership is stamped by the server through `publicWrite.ownership` instead.",
};

const assertKnownKeys = (
  id: string,
  label: string,
  value: object,
  known: readonly string[],
  hints: Record<string, string> = {},
): void => {
  const unknown = Object.keys(value).find(key => !known.includes(key));
  if (unknown === undefined) return;

  throw new ContentEngineError(
    hints[unknown] ??
      `${label}.${unknown} is not an option. ${label} accepts: ${known.join(", ")}.`,
    { contentTypeId: id },
  );
};

const assertWritableField = (
  id: string,
  label: string,
  fields: ContentFieldMap,
  name: string,
  ownerField: string,
): void => {
  if (splitContentFieldPath(name)) {
    throw new ContentEngineError(
      `${label} includes the leaf path "${name}". Only top-level fields can be written publicly.`,
      { contentTypeId: id },
    );
  }

  if (reservedNames.has(name)) {
    throw new ContentEngineError(
      `${label} includes "${name}", which the server manages. It is never client-writable.`,
      { contentTypeId: id },
    );
  }

  if (name === ownerField) {
    throw new ContentEngineError(
      `${label} includes the ownership field "${name}". The server stamps it with the signed-in user, so a client must never be able to set it.`,
      { contentTypeId: id },
    );
  }

  const fieldValue = fields[name] as ContentFieldDescriptor | undefined;
  if (!fieldValue) {
    throw new ContentEngineError(
      `${label} references unknown field "${name}".`,
      { contentTypeId: id },
    );
  }

  if (fieldValue.localized === true) {
    throw new ContentEngineError(
      `${label} includes the localized field "${name}". Public writes do not create translations yet.`,
      { contentTypeId: id },
    );
  }

  if (!writableKinds.has(fieldValue.kind)) {
    throw new ContentEngineError(
      `${label} includes "${name}" of kind "${fieldValue.kind}", which cannot be written publicly. ${UNWRITABLE_REASON[fieldValue.kind] ?? ""}`.trim(),
      { contentTypeId: id },
    );
  }

  if (fieldValue.kind === "slug" && typeof fieldValue.source === "string") {
    throw new ContentEngineError(
      `${label} includes the slug "${name}", which is derived from "${fieldValue.source}" on the server. List "${fieldValue.source}" instead - a visitor choosing their own address could squat on anybody else's.`,
      { contentTypeId: id },
    );
  }

  if (fieldValue.kind === "relation") {
    assertRelationTargetIsPublic(id, label, name, fieldValue);
  }
};

export const assertRelationTargetIsPublic = (
  id: string,
  label: string,
  name: string,
  fieldValue: ContentFieldDescriptor,
  { deferred = true }: { deferred?: boolean } = {},
): void => {
  if (fieldValue.kind !== "relation" || fieldValue.self) return;

  let target: undefined | { id: string; publicApi?: { enabled: boolean } };
  try {
    target = fieldValue.target();
  } catch (error) {
    if (deferred) return;
    throw error;
  }
  if (!target) {
    if (deferred) return;
    throw new ContentEngineError(
      `${label} includes the relation "${name}", whose target could not be resolved.`,
      { contentTypeId: id },
    );
  }

  if (target.publicApi?.enabled !== true) {
    throw new ContentEngineError(
      `${label} includes the relation "${name}", but its target "${target.id}" has no public API. A visitor may only link to records they could read - give "${target.id}" a \`publicApi\` or leave "${name}" out.`,
      { contentTypeId: id },
    );
  }
};

const listOf = (
  id: string,
  label: string,
  fields: unknown,
): readonly string[] => {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new ContentEngineError(
      `${label} is empty. There is no wildcard - list the fields a visitor may write.`,
      { contentTypeId: id },
    );
  }

  const names = fields.map(String);
  const duplicate = names.find(
    (name, position) => names.indexOf(name) !== position,
  );
  if (duplicate !== undefined) {
    throw new ContentEngineError(`${label} lists "${duplicate}" twice.`, {
      contentTypeId: id,
    });
  }

  return names;
};

const needsValueOnCreate = (fieldValue: ContentFieldDescriptor): boolean => {
  if (fieldValue.required) return true;
  const min = (fieldValue as { min?: number }).min;
  const multiple = (fieldValue as { multiple?: boolean }).multiple;

  return (
    (fieldValue.kind === "repeatable" ||
      fieldValue.kind === "blocks" ||
      multiple === true) &&
    typeof min === "number" &&
    min > 0
  );
};

export const resolvePublicWrite = (
  id: string,
  fields: ContentFieldMap,
  publicWrite: ContentPublicWriteConfig | false | undefined,
  {
    localized,
    publicApi,
  }: { localized: boolean; publicApi: ResolvedContentPublicApiConfig },
): ResolvedContentPublicWriteConfig => {
  if (publicWrite === undefined || publicWrite === false) {
    return DISABLED_PUBLIC_WRITE;
  }

  if (typeof publicWrite !== "object") {
    throw new ContentEngineError(
      "publicWrite is an options object or `false`. Omit it to keep public writing off.",
      { contentTypeId: id },
    );
  }

  assertKnownKeys(
    id,
    "publicWrite",
    publicWrite,
    ["create", "ownership", "update"],
    {
      delete:
        "publicWrite.delete is not supported. Public deletion is not part of the generated API - records are removed from the AdminCP.",
      permissions:
        "publicWrite.permissions is not an option. Owners edit their own records with `update.own`, and moderators edit any record with the content type's `can_edit` moderator permission, which is registered for you.",
    },
  );

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "publicWrite needs `publicApi`. The write routes live beside the public read routes, and a visitor has to be able to find what they wrote.",
      { contentTypeId: id },
    );
  }

  if (localized) {
    throw new ContentEngineError(
      "publicWrite is not available on a localized content type yet. A public create would have to write the default translation too, which the generated routes do not do.",
      { contentTypeId: id },
    );
  }

  const ownership = publicWrite.ownership as unknown;
  if (typeof ownership !== "object" || ownership === null) {
    throw new ContentEngineError(
      'publicWrite.ownership is required: `{ field: "<a field.user()>" }`. Every publicly written record has one owner, stamped by the server.',
      { contentTypeId: id },
    );
  }
  assertKnownKeys(id, "publicWrite.ownership", ownership, ["field"], {
    assignOnCreate:
      "publicWrite.ownership.assignOnCreate is not an option. The owner is always assigned on create, from the session - never from the payload.",
  });

  const declaredOwner = (ownership as { field?: unknown }).field;
  const ownerField = typeof declaredOwner === "string" ? declaredOwner : "";
  const owner = fields[ownerField] as ContentFieldDescriptor | undefined;
  if (!owner) {
    throw new ContentEngineError(
      `publicWrite.ownership.field references unknown field "${ownerField}".`,
      { contentTypeId: id },
    );
  }
  if (owner.kind !== "user" || owner.multiple || owner.localized === true) {
    throw new ContentEngineError(
      `publicWrite.ownership.field "${ownerField}" must be a single, shared \`field.user()\`. One record has one owner.`,
      { contentTypeId: id },
    );
  }

  const create =
    (publicWrite.create as unknown) === false ? undefined : publicWrite.create;
  const update =
    (publicWrite.update as unknown) === false ? undefined : publicWrite.update;
  if (create === undefined && update === undefined) {
    throw new ContentEngineError(
      "publicWrite enables nothing. Add `create`, `update` or both - or remove the block.",
      { contentTypeId: id },
    );
  }

  let resolvedCreate: ResolvedContentPublicWriteConfig["create"] =
    DISABLED_PUBLIC_WRITE.create;
  if (create !== undefined) {
    if (typeof create !== "object" || create === null) {
      throw new ContentEngineError(
        "publicWrite.create is an options object with `fields`.",
        { contentTypeId: id },
      );
    }
    assertKnownKeys(
      id,
      "publicWrite.create",
      create,
      ["captcha", "fields", "status"],
      {
        permission:
          "publicWrite.create.permission is not an option. A public create always needs a signed-in user, and VitNode has no per-role member permissions to narrow it further yet.",
      },
    );

    const {
      captcha,
      fields: names,
      status,
    } = create as {
      captcha?: unknown;
      fields?: unknown;
      status?: unknown;
    };
    const list = listOf(id, "publicWrite.create.fields", names);
    for (const name of list) {
      assertWritableField(
        id,
        "publicWrite.create.fields",
        fields,
        name,
        ownerField,
      );
    }

    const writable = new Set([...list, ownerField]);
    const missing = Object.entries(fields).find(
      ([name, fieldValue]) =>
        !writable.has(name) && needsValueOnCreate(fieldValue),
    );
    if (missing) {
      throw new ContentEngineError(
        `publicWrite.create.fields leaves out "${missing[0]}", which every new record needs. List it, or give it a default.`,
        { contentTypeId: id },
      );
    }

    if (
      status !== undefined &&
      !(CONTENT_PUBLICATION_STATUSES as readonly unknown[]).includes(status)
    ) {
      throw new ContentEngineError(
        `publicWrite.create.status is ${JSON.stringify(status)}. It is one of: ${CONTENT_PUBLICATION_STATUSES.join(", ")}.`,
        { contentTypeId: id },
      );
    }
    if (captcha !== undefined && typeof captcha !== "boolean") {
      throw new ContentEngineError(
        "publicWrite.create.captcha is `true` or `false`.",
        { contentTypeId: id },
      );
    }

    resolvedCreate = {
      captcha: captcha === true,
      enabled: true,
      fields: [...list],
      status: (status ??
        "draft") as ResolvedContentPublicWriteConfig["create"]["status"],
    };
  }

  let resolvedUpdate: ResolvedContentPublicWriteConfig["update"] =
    DISABLED_PUBLIC_WRITE.update;
  if (update !== undefined) {
    if (typeof update !== "object" || update === null) {
      throw new ContentEngineError(
        "publicWrite.update is an options object with `fields`.",
        { contentTypeId: id },
      );
    }
    assertKnownKeys(id, "publicWrite.update", update, ["fields", "own"], {
      permission:
        "publicWrite.update.permission is not an option. Owners are allowed by `own`, and moderators by the content type's `can_edit` moderator permission.",
    });

    const { fields: names, own } = update as {
      fields?: unknown;
      own?: unknown;
    };
    const list = listOf(id, "publicWrite.update.fields", names);
    for (const name of list) {
      assertWritableField(
        id,
        "publicWrite.update.fields",
        fields,
        name,
        ownerField,
      );
    }
    if (own !== undefined && typeof own !== "boolean") {
      throw new ContentEngineError(
        "publicWrite.update.own is `true` or `false`.",
        { contentTypeId: id },
      );
    }

    resolvedUpdate = { enabled: true, fields: [...list], own: own !== false };
  }

  return {
    create: resolvedCreate,
    enabled: true,
    ownerField,
    update: resolvedUpdate,
  };
};
