import type { PermissionStaffEntryInput } from "../../api/lib/permission-staff";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentContainerDefinition } from "./types";

import { CONTENT_PERMISSIONS } from "../const";
import { ContentEngineError } from "../errors";
import { contentContainerFieldOf } from "./association";
import { isContentContainerDefinition } from "./guard";

/** A container definition plus the plugin that registered it. */
export interface RegisteredContentContainer {
  definition: AnyContentContainerDefinition;
  pluginId: string;
}

const describe = (entry: RegisteredContentContainer): string =>
  `${entry.pluginId} -> ${entry.definition.id}`;

/**
 * Validates container definitions from one or more plugins. Runs at boot, per
 * plugin and once more across every plugin, like `validateContentTypes`.
 *
 * Ids are global - every row in `core_content_containers` carries one - and
 * AdminCP paths are a site-wide URL namespace (`/admin/containers/{path}`).
 */
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
      // The same object registered twice by one plugin - say, by its admin and
      // its public module - is one definition, not a clash.
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

/**
 * Container collections and content types of one plugin share two namespaces:
 * admin modules (`/admin/content/{permissionModule}`) and public paths
 * (`/content/{publicApi.path}`). A clash would mount two route sets on one URL.
 */
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

  for (const definition of contentTypes) {
    modules.set(definition.permissionModule, definition.id);
    if (definition.publicApi.enabled) {
      paths.set(definition.publicApi.path, definition.id);
    }
  }

  for (const definition of containers) {
    const module = definition.admin.permissionModule;
    const moduleOwner = modules.get(module);
    if (moduleOwner !== undefined && moduleOwner !== definition.id) {
      throw new ContentEngineError(
        `Permission module "${module}" is used by both ${pluginId} -> ${moduleOwner} and ${pluginId} -> ${definition.id}. Set \`admin.permissionModule\` on one of them.`,
        { contentTypeId: definition.id },
      );
    }
    modules.set(module, definition.id);

    if (!definition.publicApi.enabled) continue;
    const path = definition.publicApi.path;
    const pathOwner = paths.get(path);
    if (pathOwner !== undefined && pathOwner !== definition.id) {
      throw new ContentEngineError(
        `Public path "${path}" is claimed by both ${pluginId} -> ${pathOwner} and ${pluginId} -> ${definition.id}. Give one of them a different \`publicApi.path\`.`,
        { contentTypeId: definition.id },
      );
    }
    paths.set(path, definition.id);
  }
};

/**
 * Every content type's `field.container()` must name a registered collection -
 * otherwise records could point at containers no screen manages and no route
 * reads. Runs once, across every plugin, because a content type may use a
 * collection another plugin owns.
 */
export const assertContentContainerReferences = (
  contentTypes: readonly AnyContentTypeDefinition[],
  containers: readonly RegisteredContentContainer[],
): void => {
  const registered = new Map(
    containers.map(entry => [entry.definition.id, entry.definition]),
  );

  for (const definition of contentTypes) {
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

/** `can_view`, plus create, edit and delete that each depend on it - the same shape a content type gets. */
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
