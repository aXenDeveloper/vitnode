import type { PermissionStaffEntryInput } from "../../api/lib/permission-staff";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentContainerDefinition } from "./types";

import { CONTENT_PERMISSIONS } from "../const";
import { ContentEngineError } from "../errors";
import {
  contentContainerFieldOf,
  contentContainerSourceOf,
} from "./association";
import { isContentContainerDefinition } from "./guard";

export interface RegisteredContentContainer {
  definition: AnyContentContainerDefinition;
  pluginId: string;
}

const describe = (entry: RegisteredContentContainer): string =>
  `${entry.pluginId} -> ${entry.definition.id}`;

export const validateContentContainers = (
  entries: readonly RegisteredContentContainer[],
): RegisteredContentContainer[] => {
  const byId = new Map<string, RegisteredContentContainer>();
  const byAdminPath = new Map<string, RegisteredContentContainer>();

  for (const entry of entries) {
    const { definition } = entry;
    if (!isContentContainerDefinition(definition)) {
      throw new ContentEngineError(
        `${entry.pluginId} registers a container that was not built with \`defineContentContainer\`.`,
      );
    }

    const duplicate = byId.get(definition.id);
    if (duplicate) {
      if (
        duplicate.definition === definition &&
        duplicate.pluginId === entry.pluginId
      ) {
        continue;
      }

      throw new ContentEngineError(
        `Duplicate container definition id, registered by both ${describe(duplicate)} and ${describe(entry)}.`,
        { contentTypeId: definition.id },
      );
    }
    byId.set(definition.id, entry);

    const duplicatePath = byAdminPath.get(definition.admin.path);
    if (duplicatePath) {
      throw new ContentEngineError(
        `AdminCP path "${definition.admin.path}" is claimed by both ${describe(duplicatePath)} and ${describe(entry)}. Give one of them a different \`admin.path\`.`,
        { contentTypeId: definition.id },
      );
    }
    byAdminPath.set(definition.admin.path, entry);
  }

  return [...byId.values()].sort((a, b) =>
    a.definition.id.localeCompare(b.definition.id),
  );
};

export const assertContentContainerNamespaces = ({
  containers,
  contentTypes,
  pluginId,
}: {
  containers: readonly AnyContentContainerDefinition[];
  contentTypes: readonly AnyContentTypeDefinition[];
  pluginId: string;
}): void => {
  const modules = new Map<string, string>();
  const paths = new Map<string, string>();
  const describeOwner = (owner: string): string =>
    `${pluginId} -> ${owner.slice(owner.indexOf(":") + 1)}`;

  for (const definition of contentTypes) {
    modules.set(definition.permissionModule, `type:${definition.id}`);
    if (definition.publicApi.enabled) {
      paths.set(definition.publicApi.path, `type:${definition.id}`);
    }
  }

  for (const definition of containers) {
    const self = `container:${definition.id}`;
    const module = definition.admin.permissionModule;
    const moduleOwner = modules.get(module);
    if (moduleOwner !== undefined && moduleOwner !== self) {
      throw new ContentEngineError(
        `Permission module "${module}" is used by both ${describeOwner(moduleOwner)} and ${pluginId} -> ${definition.id}. Set \`admin.permissionModule\` on one of them.`,
        { contentTypeId: definition.id },
      );
    }
    modules.set(module, self);

    if (!definition.publicApi.enabled) continue;
    const path = definition.publicApi.path;
    const pathOwner = paths.get(path);
    if (pathOwner !== undefined && pathOwner !== self) {
      throw new ContentEngineError(
        `Public path "${path}" is claimed by both ${describeOwner(pathOwner)} and ${pluginId} -> ${definition.id}. Give one of them a different \`publicApi.path\`.`,
        { contentTypeId: definition.id },
      );
    }
    paths.set(path, self);
  }
};

export const assertContentContainerReferences = (
  contentTypes: readonly AnyContentTypeDefinition[],
  containers: readonly RegisteredContentContainer[],
): void => {
  const registered = new Map(
    containers.map(entry => [entry.definition.id, entry.definition]),
  );

  for (const definition of contentTypes) {
    const source = contentContainerSourceOf(definition);
    if (source?.kind === "relation" && !source.container) {
      throw new ContentEngineError(
        `Field "${source.name}" is \`container: true\`, but its target ${source.target ? `"${source.target.id}"` : "could not be resolved and"} is not filed in a container. Point it at a content type with a \`field.container()\`.`,
        { contentTypeId: definition.id },
      );
    }

    const container = contentContainerFieldOf(definition);
    if (!container) continue;

    if (!registered.has(container.field.definition.id)) {
      throw new ContentEngineError(
        `Field "${container.name}" uses the container collection "${container.field.definition.id}", which no plugin registers. Pass it to \`buildContentAdminModule({ containers: [...] })\`.`,
        { contentTypeId: definition.id },
      );
    }
  }
};

export const contentContainerPermissionEntries =
  (): PermissionStaffEntryInput[] => [
    CONTENT_PERMISSIONS.view,
    {
      dependsOn: [CONTENT_PERMISSIONS.view],
      permission: CONTENT_PERMISSIONS.create,
    },
    {
      dependsOn: [CONTENT_PERMISSIONS.view],
      permission: CONTENT_PERMISSIONS.edit,
    },
    {
      dependsOn: [CONTENT_PERMISSIONS.view],
      permission: CONTENT_PERMISSIONS.delete,
    },
  ];
