import { UserError } from "../errors";

const SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const suggestKebab = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

export const assertSegment = (value: string, what: string): string => {
  if (SEGMENT.test(value)) return value;

  const suggestion = suggestKebab(value);

  throw new UserError(`"${value}" is not a valid ${what}.`, {
    details: [
      "Use lower-case kebab-case that starts with a letter, e.g. notes or site-notes.",
      `A module name is also its URL segment, so VitNode does not rename it for you.`,
    ],
    hint:
      suggestion !== "" && SEGMENT.test(suggestion) && suggestion !== value
        ? `Did you mean "${suggestion}"?`
        : undefined,
  });
};

export const parseLogicalPath = (input: string, what: string): string[] => {
  const trimmed = input.trim();

  if (trimmed === "") throw new UserError(`The ${what} is empty.`);

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("~") ||
    /^[A-Za-z]:/.test(trimmed) ||
    trimmed.includes("\\")
  ) {
    throw new UserError(`"${input}" looks like a file path, not a ${what}.`, {
      details: [
        "Name modules by their logical path inside the plugin, e.g. notes or admin/notes.",
        "The generator decides where the files go: src/api/modules/<path>/.",
      ],
    });
  }

  const segments = trimmed.split("/");

  if (
    segments.some(
      segment => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new UserError(`"${input}" is not a valid ${what}.`, {
      details: [
        "Segments are separated by a single /, and . or .. are not allowed.",
      ],
    });
  }

  return segments.map(segment => assertSegment(segment, `${what} segment`));
};

export const camelCase = (kebab: string): string =>
  kebab.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());

export const pascalCase = (kebab: string): string => {
  const camel = camelCase(kebab);

  return `${camel[0]?.toUpperCase() ?? ""}${camel.slice(1)}`;
};

export const moduleIdentifier = (modulePath: readonly string[]): string =>
  `${camelCase(modulePath.join("-"))}Module`;

export const routeIdentifier = (
  routeName: string,
  modulePath: readonly string[],
): string =>
  `${camelCase(routeName)}${pascalCase(modulePath[modulePath.length - 1] ?? "")}Route`;

export const serviceFactoryIdentifier = (
  modulePath: readonly string[],
): string =>
  `create${pascalCase(modulePath[modulePath.length - 1] ?? "")}Service`;

export const humanize = (kebab: string): string => {
  const words = kebab.replace(/[-_]+/g, " ").trim();

  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
};

export interface PermissionRef {
  module: string;
  permission: string;
}

const PERMISSION_PART = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/;

export const parsePermission = (input: string): PermissionRef => {
  const parts = input.trim().split(".");
  const [module, permission] = parts;

  if (
    parts.length !== 2 ||
    module === undefined ||
    permission === undefined ||
    !PERMISSION_PART.test(module) ||
    !PERMISSION_PART.test(permission)
  ) {
    throw new UserError(`"${input}" is not a valid staff permission.`, {
      details: [
        "Write it as <module>.<permission>, e.g. notes.can_create.",
        "Both parts are lower-case words of letters and digits joined by single _ or -. The plugin id is implied.",
      ],
    });
  }

  return { module, permission };
};

export const permissionLabel = ({
  module,
  permission,
}: PermissionRef): string => {
  const verb = /^can_(.+)$/.exec(permission)?.[1];

  return verb === undefined
    ? humanize(permission)
    : `${humanize(verb)} ${humanize(module).toLowerCase()}`;
};
