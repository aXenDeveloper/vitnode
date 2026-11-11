import type { CallExpression, ObjectExpression } from "oxc-parser";

import type { Edit, ParsedSource } from "./ast";
import type { GenerateContext } from "./generators";

import { ConfigError, UserError } from "../errors";
import {
  editableProperty,
  locate,
  lookupModule,
  readParsed,
  specifierFor,
  UnsupportedStructureError,
  withManual,
} from "./api-tree";
import {
  addNamedImport,
  addProperty,
  appendToArray,
  applyEdits,
  arrayValue,
  findCalls,
  findConstInit,
  isExported,
  objectArgument,
  parseSource,
  topLevelNames,
  unwrap,
} from "./ast";
import {
  ensureBuilders,
  locatePermissionStaff,
  planModule,
  propertyKey,
  readAdminPermissions,
} from "./generators";
import { camelCase, humanize } from "./names";
import { API_BUILDERS } from "./project";

export interface ContentField {
  name: string;
  optional: boolean;
  type: ContentFieldType;
}

export type ContentFieldType =
  | "boolean"
  | "int"
  | "number"
  | "richText"
  | "text";

const CONTENT_FIELD_TYPES: Record<
  ContentFieldType,
  (optional: boolean) => string
> = {
  boolean: () => "field.boolean({ defaultValue: false })",
  int: optional =>
    `field.number({ integer: true${optional ? ", nullable: true" : ", required: true"} })`,
  number: optional =>
    `field.number({ integer: false${optional ? ", nullable: true" : ", required: true"} })`,
  richText: optional =>
    `field.richText({${optional ? " nullable: true" : " required: true"} })`,
  text: optional =>
    `field.text({ maxLength: 200${optional ? ", nullable: true" : ", required: true"} })`,
};

const CONTENT_ID = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

export const parseContentFields = (input: string): ContentField[] => {
  const fields = input
    .split(",")
    .map(part => part.trim())
    .filter(part => part !== "")
    .map(part => {
      const [, name, optional, type] =
        /^([^:?\s]+)(\?)?\s*:\s*(\S+)$/.exec(part) ?? [];
      if (name === undefined || type === undefined) {
        throw new UserError(`"${part}" is not a field definition.`, {
          details: [
            "Write fields as name:type, e.g. title:text,body:richText,featured?:boolean.",
          ],
        });
      }
      if (
        !/^[a-z][A-Za-z0-9]*$/.test(name) ||
        ["createdAt", "id", "updatedAt"].includes(name)
      ) {
        throw new UserError(`"${name}" is not a supported field name.`, {
          details: [
            "Use camelCase. id, createdAt and updatedAt are added by the Content Engine.",
          ],
        });
      }
      if (!Object.hasOwn(CONTENT_FIELD_TYPES, type)) {
        throw new UserError(
          `"${type}" is not a supported content field type here.`,
          {
            hint: `Use one of: ${Object.keys(CONTENT_FIELD_TYPES).join(", ")}. Add other field helpers by hand afterwards.`,
          },
        );
      }

      return {
        name,
        optional: optional === "?",
        type: type as ContentFieldType,
      };
    });

  if (!fields.some(field => field.type === "text" && !field.optional)) {
    throw new UserError(
      "A content type needs a required text field for its title.",
      {
        details: [
          "The first required text field becomes admin.titleField, which the AdminCP list and pickers show.",
          'For example: --fields "title:text,body:richText".',
        ],
      },
    );
  }

  const names = fields.map(field => field.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate !== undefined)
    throw new UserError(`The field "${duplicate}" is listed twice.`);

  return fields;
};

export interface ContentResourceOptions {
  fields: readonly ContentField[];
  id?: string;
  idStrategy: "bigint" | "serial" | "uuid";
  singular?: string;
  tableName?: string;
}

export interface ContentResourceResult {
  adminPath: string;
  contentTypeId: string;
  permissionModule: string;
  tableName: string;
}

const shortName = (pluginId: string) =>
  pluginId.includes("/") ? pluginId.slice(pluginId.indexOf("/") + 1) : pluginId;

const NAV = "src/admin/nav.tsx";
const CONTENT = "src/admin/content.tsx";
const LOCALE = "src/locales/en.json";
const RE_EXPORT =
  /^\s*export\s*\{\s*adminNav\s+as\s+adminContent\s*\}\s*from\s*["']\.\/nav["'];?\s*$/;

const CONTENT_ADMIN_PERMISSIONS = [
  "can_view",
  "can_create",
  "can_edit",
  "can_delete",
] as const;

const assertContentPermissions = (
  ctx: GenerateContext,
  permissionModule: string,
): void => {
  const declarations = readAdminPermissions(ctx);
  const lines = CONTENT_ADMIN_PERMISSIONS.map(permission =>
    permission === "can_view"
      ? `    "can_view",`
      : `    { permission: ${JSON.stringify(permission)}, dependsOn: ["can_view"] },`,
  );

  if (declarations.status === "unresolved") {
    throw new UnsupportedStructureError(
      `Cannot tell whether the plugin declares the "${permissionModule}" permission module itself: ${declarations.reason}.`,
      [
        `The Content Engine adds ${CONTENT_ADMIN_PERMISSIONS.join(", ")} to "${permissionModule}" only when the plugin does not declare that module.`,
      ],
      [
        `Check permissionStaff.admin by hand: it must either have no ${JSON.stringify(permissionModule)} key, or list all four:`,
        `  ${propertyKey(permissionModule)}: [`,
        ...lines,
        "  ],",
        "Then make permissionStaff an object literal in buildApiPlugin (or staffPermissions.config from defineStaffPermissions({ ... })) and run the command again.",
      ],
    );
  }

  const declared = declarations.modules.get(permissionModule);
  if (declared === undefined) return;

  const have = new Set(declared);
  const missing = CONTENT_ADMIN_PERMISSIONS.filter(
    permission => !have.has(permission),
  );
  if (missing.length === 0) return;

  const location = locatePermissionStaff(ctx);
  const file =
    location.kind === "unresolved" ? "src/config.api.ts" : location.file;
  throw new ConfigError(
    `The plugin declares the permission module "${permissionModule}" without ${missing.join(", ")}.`,
    {
      details: [
        `The Content Engine adds ${CONTENT_ADMIN_PERMISSIONS.join(", ")} to "${permissionModule}" only when the plugin does not declare it, and ${file} declares it with ${declared.length === 0 ? "no permissions" : declared.join(", ")}.`,
        "The generated staff routes would require permissions nobody can be granted. Nothing was written.",
        `Add the missing ones to permissionStaff.admin[${JSON.stringify(permissionModule)}] in ${file}:`,
        ...lines.filter((_, index) =>
          missing.includes(CONTENT_ADMIN_PERMISSIONS[index] ?? "can_view"),
        ),
        `Or remove the ${JSON.stringify(permissionModule)} entry, so the Content Engine declares all four itself.`,
      ],
      hint: "Then run the command again.",
    },
  );
};

const navEntry = (definition: string) =>
  `{ definition: ${definition}, icon: <FileTextIcon /> }`;

const planAdminNav = (
  ctx: GenerateContext,
  definition: string,
  definitionFile: string,
): void => {
  const { plan, project } = ctx;
  const manual = [
    `Import ${definition} and FileTextIcon (lucide-react) in ${NAV}, and add`,
    `  ${navEntry(definition)}`,
    'to the contentTypes of its adminNav; src/admin/content.tsx must list it too (export { adminNav as adminContent } from "./nav" does).',
  ];

  const contentSource = plan.read(CONTENT);
  const navSource = plan.read(NAV);

  if (
    contentSource !== null &&
    !RE_EXPORT.test(
      contentSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").trim(),
    )
  ) {
    throw new UnsupportedStructureError(
      `${CONTENT} builds its own adminContent, so the generator cannot add the screen safely.`,
      [
        `Only a missing ${CONTENT} or \`export { adminNav as adminContent } from "./nav"\` is edited automatically.`,
      ],
      manual,
    );
  }

  if (navSource === null) {
    plan.create(
      NAV,
      `import type { AdminNavPluginSource } from "@vitnode/core/lib/plugin";

import { FileTextIcon } from "lucide-react";

import { ${definition} } from ${JSON.stringify(specifierFor(project, NAV, definitionFile, true))};
import { manifest } from ${JSON.stringify(specifierFor(project, NAV, "src/manifest.gen.ts", true))};

/** The plugin's AdminCP sidebar entries. */
export const adminNav = {
  pluginId: manifest.id,
  contentTypes: [${navEntry(definition)}],
} satisfies AdminNavPluginSource;
`,
      "AdminCP sidebar entry",
    );
  } else {
    let parsed: ParsedSource = parseSource(NAV, navSource);
    const init = findConstInit(parsed.program, "adminNav");
    const object = init === null ? null : unwrap(init);
    if (object?.type !== "ObjectExpression") {
      throw new UnsupportedStructureError(
        `${NAV} has no plain \`export const adminNav = { ... }\` object.`,
        [],
        manual,
      );
    }
    withManual(manual, () =>
      editableProperty(parsed, object, "contentTypes", `adminNav in ${NAV}`),
    );

    let source = navSource;
    for (const [specifier, name] of [
      ["lucide-react", "FileTextIcon"],
      [specifierFor(project, NAV, definitionFile, true), definition],
    ] as const) {
      if (topLevelNames(parsed.program).has(name)) {
        if (name === "FileTextIcon") continue;
        throw new UserError(`${NAV} already declares ${name}.`);
      }
      source = applyEdits(source, addNamedImport(parsed, specifier, name));
      parsed = parseSource(NAV, source);
    }

    const reread = unwrap(
      findConstInit(parsed.program, "adminNav") ?? object,
    ) as ObjectExpression;
    const property = withManual(manual, () =>
      editableProperty(parsed, reread, "contentTypes", `adminNav in ${NAV}`),
    );
    const list = arrayValue(property);
    if (property !== null && list === null) {
      throw new UnsupportedStructureError(
        `adminNav.contentTypes in ${NAV} is not an array literal.`,
        [],
        manual,
      );
    }
    source = applyEdits(
      source,
      list === null
        ? addProperty(
            source,
            reread,
            `contentTypes: [${navEntry(definition)}]`,
            "pluginId",
          )
        : appendToArray(source, list, navEntry(definition)),
    );
    plan.update(NAV, source, `AdminCP sidebar entry for ${definition}`);
  }

  if (contentSource === null) {
    plan.create(
      CONTENT,
      `// The AdminCP screens: the same content types as the sidebar.
export { adminNav as adminContent } from "./nav";
`,
      "AdminCP screens, re-using the sidebar list",
    );
  }
};

const ensureContentBuilders = (ctx: GenerateContext): void => {
  const parsed = readParsed(ctx.plan, API_BUILDERS);
  if (isExported(parsed.program, "buildContentAdminModule")) return;

  if (
    !topLevelNames(parsed.program).has("manifest") ||
    topLevelNames(parsed.program).has("contentBuilders")
  ) {
    throw new UnsupportedStructureError(
      `${API_BUILDERS} does not export buildContentAdminModule, and cannot be extended safely.`,
      [],
      [
        'import { bindContentPlugin } from "@vitnode/core/content/server";',
        "const contentBuilders = bindContentPlugin(manifest);",
        "export const buildContentAdminModule = contentBuilders.buildContentAdminModule;",
      ],
    );
  }

  let source = applyEdits(
    parsed.source,
    addNamedImport(parsed, "@vitnode/core/content/server", "bindContentPlugin"),
  );
  source = `${source.trimEnd()}

const contentBuilders = bindContentPlugin(manifest);

export const buildContentAdminModule = contentBuilders.buildContentAdminModule;
`;
  ctx.plan.update(
    API_BUILDERS,
    source,
    "bind the Content Engine admin builder",
  );
};

const planAdminContentModule = (
  ctx: GenerateContext,
  model: string,
  modelFile: string,
): void => {
  const { plan, project } = ctx;
  const lookup = lookupModule(plan, project, ["admin"]);
  const admin =
    lookup.status === "found"
      ? lookup.module
      : planModule(ctx, ["admin"], { parents: false });
  const manual = [
    `Import ${model} from ${JSON.stringify(specifierFor(project, admin.file, modelFile, true))} in ${admin.file}, and either add it to the contentTypes of its buildContentAdminModule({ contentTypes: [...] })`,
    `or add buildContentAdminModule({ contentTypes: [${model}] }) to the admin module's modules (buildContentAdminModule comes from ${specifierFor(project, admin.file, API_BUILDERS, true)}).`,
  ];
  withManual(manual, () =>
    editableProperty(
      admin.parsed,
      admin.options,
      "modules",
      "the admin module",
    ),
  );

  let parsed = readParsed(plan, admin.file);
  let source = parsed.source;
  for (const [specifier, name] of [
    [
      specifierFor(project, admin.file, API_BUILDERS, true),
      "buildContentAdminModule",
    ],
    [specifierFor(project, admin.file, modelFile, true), model],
  ] as const) {
    if (name === model && topLevelNames(parsed.program).has(name)) {
      throw new UserError(`${admin.file} already declares ${name}.`);
    }
    source = applyEdits(source, addNamedImport(parsed, specifier, name));
    parsed = parseSource(admin.file, source);
  }

  const init = findConstInit(parsed.program, admin.exportName);
  const call = init === null ? null : unwrap(init);
  const options = call?.type === "CallExpression" ? objectArgument(call) : null;
  if (options === null) {
    throw new UnsupportedStructureError(
      `The admin module in ${admin.file} could not be read.`,
      [],
      manual,
    );
  }

  const modulesProperty = withManual(manual, () =>
    editableProperty(parsed, options, "modules", "the admin module"),
  );
  const modules = arrayValue(modulesProperty);
  if (modulesProperty !== null && modules === null) {
    throw new UnsupportedStructureError(
      "The modules of the admin module are not an array literal.",
      [`At ${locate(parsed, modulesProperty.start)}.`],
      manual,
    );
  }
  const existing: CallExpression[] =
    modules === null
      ? []
      : findCalls(parsed.program, "buildContentAdminModule").filter(
          node => node.start >= modules.start && node.end <= modules.end,
        );

  if (existing.length > 1) {
    throw new UnsupportedStructureError(
      `The admin module in ${admin.file} mounts buildContentAdminModule more than once.`,
      [],
      [`Add ${model} to the contentTypes of one of them.`],
    );
  }

  let edits: Edit[];
  const first = existing[0];
  if (first !== undefined) {
    const argument = objectArgument(first);
    const contentTypes =
      argument === null
        ? null
        : arrayValue(
            withManual([`Add ${model} to its contentTypes.`], () =>
              editableProperty(
                parsed,
                argument,
                "contentTypes",
                `buildContentAdminModule in ${admin.file}`,
              ),
            ),
          );
    if (contentTypes === null) {
      throw new UnsupportedStructureError(
        `buildContentAdminModule in ${admin.file} has no contentTypes array literal.`,
        [],
        [`Add ${model} to its contentTypes.`],
      );
    }
    edits = appendToArray(source, contentTypes, model);
  } else {
    const entry = `buildContentAdminModule({ contentTypes: [${model}] })`;
    edits =
      modules === null
        ? addProperty(source, options, `modules: [${entry}]`, "routes")
        : appendToArray(source, modules, entry);
  }

  plan.update(
    admin.file,
    applyEdits(source, edits),
    `mount ${model} in the admin module`,
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mergeMissing = (
  target: Record<string, unknown>,
  extra: Record<string, unknown>,
) => {
  for (const [key, value] of Object.entries(extra)) {
    const current = target[key];
    if (current === undefined) target[key] = value;
    else if (isRecord(current) && isRecord(value)) mergeMissing(current, value);
  }
};

const planLabels = (
  ctx: GenerateContext,
  labels: Record<string, unknown>,
): void => {
  const source = ctx.plan.read(LOCALE);
  let messages: unknown = null;
  try {
    messages = source === null ? null : JSON.parse(source);
  } catch {
    messages = null;
  }

  if (
    source === null ||
    !isRecord(messages) ||
    `${JSON.stringify(messages, null, 2)}\n` !== source
  ) {
    ctx.notes.push(
      `Add these labels to ${LOCALE} by hand (it is missing or not plain two-space JSON):`,
    );
    ctx.notes.push(JSON.stringify(labels, null, 2));

    return;
  }

  const merged = structuredClone(messages);
  mergeMissing(merged, labels);
  const next = `${JSON.stringify(merged, null, 2)}\n`;
  if (next !== source)
    ctx.plan.update(LOCALE, next, "AdminCP labels for the content type");
};

export const planContentResource = (
  ctx: GenerateContext,
  name: string,
  options: ContentResourceOptions,
): ContentResourceResult => {
  const { plan, project } = ctx;
  const plugin = shortName(project.id);
  const prefix = plugin.replace(/[^a-z0-9]/g, "");
  const contentTypeId = options.id ?? `${prefix}.${name}`;
  const tableName =
    options.tableName ??
    `${plugin.replace(/[^a-z0-9]+/g, "_")}_${name.replace(/-/g, "_")}`;

  if (!CONTENT_ID.test(contentTypeId)) {
    throw new UserError(`"${contentTypeId}" is not a valid content type id.`, {
      details: [
        'It must look like "plugin.entity": lower-case, dot separated, no dash in the first part.',
      ],
      hint: "Pass one with --content-id, e.g. --content-id sitenotes.articles.",
    });
  }
  if (!TABLE_NAME.test(tableName)) {
    throw new UserError(`"${tableName}" is not a valid table name.`, {
      hint: "Pass one with --table, in snake_case starting with a letter.",
    });
  }

  const entity = contentTypeId.split(".").slice(1).join("_");
  const permissionModule = entity
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const camel = camelCase(name);
  const definition = `${camel}ContentType`;
  const model = `${camel}Content`;
  const definitionFile = `src/content/${name}.ts`;
  const modelFile = `src/database/${name}.ts`;
  const adminPath = `${plugin.replace(/[^a-z0-9-]/g, "")}/${name}`;
  const title =
    options.fields.find(field => field.type === "text" && !field.optional)
      ?.name ?? "";
  const plural = humanize(name);
  const singular = options.singular ?? plural;

  assertContentPermissions(ctx, permissionModule);
  ensureBuilders(ctx);

  plan.create(
    definitionFile,
    `import { defineContentType, field } from "@vitnode/core/content";

/**
 * ${plural}, managed by staff in the AdminCP.
 *
 * Generated as an administrative content type: no public API, no member
 * writes, no publication workflow. Enable those here when you decide who may
 * read and write ${plural.toLowerCase()} - each one changes access to the records.
 *
 * Browser-safe: the server model is \`${model}\` in ${modelFile.replace(/^src\//, "@/").replace(/\.ts$/, "")}.
 */
export const ${definition} = defineContentType({
  id: ${JSON.stringify(contentTypeId)},
  tableName: ${JSON.stringify(tableName)},
${options.idStrategy === "serial" ? "" : `  idStrategy: ${JSON.stringify(options.idStrategy)},\n`}  fields: {
${options.fields.map(field => `    ${field.name}: ${CONTENT_FIELD_TYPES[field.type](field.optional)},`).join("\n")}
  },
  admin: {
    path: ${JSON.stringify(adminPath)},
    titleField: ${JSON.stringify(title)},
    list: {
      columns: [${JSON.stringify(title)}, "updatedAt"],
    },
  },
});
`,
    `content type ${contentTypeId}`,
  );

  plan.create(
    modelFile,
    `import { createContentModel } from "@vitnode/core/content/server";

import { ${definition} } from ${JSON.stringify(specifierFor(project, modelFile, definitionFile, true))};

/** The server-side model of {@link ${definition}}. Server-only. */
export const ${model} = createContentModel(${definition});

// Migrations find tables through the exports of the built src/database files.
export const ${tableName} = ${model}.table;
`,
    `model and table ${tableName}`,
  );

  ensureContentBuilders(ctx);
  planAdminContentModule(ctx, model, modelFile);
  planAdminNav(ctx, definition, definitionFile);

  const fieldLabels = Object.fromEntries([
    ...options.fields.map(field => [
      field.name,
      humanize(field.name.replace(/([A-Z])/g, " $1").toLowerCase()),
    ]),
    ["updatedAt", "Updated"],
  ]);
  planLabels(ctx, {
    [project.id]: {
      content: {
        [entity]: {
          desc: `Manage ${plural.toLowerCase()}.`,
          fields: fieldLabels,
          label: `{count, plural, one {${singular}} other {${plural}}}`,
          title: plural,
        },
      },
      title: humanize(plugin),
    },
    [`${project.id}:${permissionModule}`]: plural,
    [`${project.id}:${permissionModule}:can_view`]: `View ${plural.toLowerCase()}`,
    [`${project.id}:${permissionModule}:can_create`]: `Create ${plural.toLowerCase()}`,
    [`${project.id}:${permissionModule}:can_edit`]: `Edit ${plural.toLowerCase()}`,
    [`${project.id}:${permissionModule}:can_delete`]: `Delete ${plural.toLowerCase()}`,
  });

  return { adminPath, contentTypeId, permissionModule, tableName };
};
