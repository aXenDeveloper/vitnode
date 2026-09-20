import {
  BLOCK_ID_MAX_LENGTH,
  BLOCK_NAME_PATTERN,
  BLOCK_NAMESPACE_PATTERN,
  BLOCK_NAMESPACE_SEPARATOR,
  BLOCK_WILDCARD,
} from "./const";
import { BlockError } from "./errors";

const sanitize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const blockNamespaceForPlugin = (pluginId: string): string => {
  const segment = pluginId.split("/").pop() ?? "";
  const namespace = sanitize(segment);

  if (namespace === "") {
    throw new BlockError(
      `Plugin id "${pluginId}" has no letters or digits in its last segment, so it cannot name a block namespace. Set \`namespace\` on the plugin's blocks module.`,
    );
  }

  return namespace;
};

export const assertBlockNamespace = (
  namespace: string,
  pluginId: string,
): string => {
  if (!BLOCK_NAMESPACE_PATTERN.test(namespace)) {
    throw new BlockError(
      `Plugin "${pluginId}" declares the block namespace "${namespace}". A namespace is lowercase letters, digits and single hyphens.`,
    );
  }

  return namespace;
};

export const assertBlockName = (name: string): string => {
  if (!BLOCK_NAME_PATTERN.test(name)) {
    throw new BlockError(
      `Block id "${name}" must be lowercase letters, digits and single hyphens. The plugin's namespace is prefixed for you at registration, so do not write it yourself.`,
    );
  }

  return name;
};

export const qualifiedBlockId = (namespace: string, name: string): string => {
  const type = `${namespace}${BLOCK_NAMESPACE_SEPARATOR}${name}`;

  if (type.length > BLOCK_ID_MAX_LENGTH) {
    throw new BlockError(
      `Block id "${type}" is longer than ${BLOCK_ID_MAX_LENGTH} characters. It is written into every stored block instance, so keep it short.`,
    );
  }

  return type;
};

export interface ParsedBlockId {
  name: string;
  namespace: string;
}

export const parseBlockId = (type: string): null | ParsedBlockId => {
  const separator = type.indexOf(BLOCK_NAMESPACE_SEPARATOR);
  if (separator <= 0 || separator === type.length - 1) return null;

  const namespace = type.slice(0, separator);
  const name = type.slice(separator + 1);

  if (name.includes(BLOCK_NAMESPACE_SEPARATOR)) return null;
  if (!BLOCK_NAMESPACE_PATTERN.test(namespace)) return null;
  if (name !== BLOCK_WILDCARD && !BLOCK_NAME_PATTERN.test(name)) return null;

  return { name, namespace };
};
