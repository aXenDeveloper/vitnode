import type { AnyEditablePageDefinition } from "@/content/editor/types";

import type { PermissionStaffCatalogEntry } from "./permission-staff";

export interface EditablePageStaffPermission {
  module: string;
  permission: string;
  plugin: string;
}

export interface RegisteredEditablePage {
  page: AnyEditablePageDefinition;
  /**
   * The moderator permission a save has to satisfy, resolved once at boot.
   *
   * `plugin` falls back to whoever registered the page, so one plugin can never
   * satisfy another's permission by declaring a module of the same name.
   */
  permission: EditablePageStaffPermission;
  pluginId: string;
}

export class EditablePageRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditablePageRegistryError";
  }
}

export const registerEditablePage = (
  page: AnyEditablePageDefinition,
  pluginId: string,
): RegisteredEditablePage => ({
  page,
  permission: {
    module: page.permission.module,
    permission: page.permission.permission,
    plugin: page.permission.plugin ?? pluginId,
  },
  pluginId,
});

/**
 * One page id, one definition - checked wherever definitions are collected.
 *
 * A page id is how a stored layout finds the zones, the allowlists and the
 * permission it has to be read and written through. Two definitions claiming
 * one id would mean the answer depends on which plugin loaded first, so it is a
 * startup failure rather than a race.
 */
export const validateEditablePages = (
  entries: readonly RegisteredEditablePage[],
): RegisteredEditablePage[] => {
  const byId = new Map<string, RegisteredEditablePage>();

  for (const entry of entries) {
    if (!entry.permission.module || !entry.permission.permission) {
      throw new EditablePageRegistryError(
        `The editable page "${entry.page.id}" declares no \`permission: { module, permission }\`. A page is edited on the public site, where the only thing standing between a visitor and its layout is that moderator permission, so a page without one is refused rather than left open.`,
      );
    }

    const taken = byId.get(entry.page.id);

    if (taken) {
      throw new EditablePageRegistryError(
        taken.pluginId === entry.pluginId
          ? `The plugin "${entry.pluginId}" registers the editable page "${entry.page.id}" twice. A page id names one set of zones, one allowlist per zone and one permission, so it can only be declared once.`
          : `The plugins "${taken.pluginId}" and "${entry.pluginId}" both register the editable page "${entry.page.id}". Whichever loaded last would decide which zones exist and who may edit them, so the collision is refused here instead.`,
      );
    }

    byId.set(entry.page.id, entry);
  }

  return [...byId.values()];
};

export const assertEditablePagePermissionsGrantable = ({
  pages,
  permissionStaff,
}: {
  pages: readonly RegisteredEditablePage[];
  permissionStaff: readonly PermissionStaffCatalogEntry[];
}): void => {
  for (const entry of pages) {
    const { module, permission, plugin } = entry.permission;
    const declared = permissionStaff.find(
      candidate => candidate.pluginId === plugin,
    );

    if (!declared) {
      throw new EditablePageRegistryError(
        `The editable page "${entry.page.id}" is edited with the moderator permission "${permission}" of "${plugin}"'s "${module}" module, and no plugin "${plugin}" is installed. Nobody could ever be granted it, so the page would be editable by root roles alone and every other save would be a 403.`,
      );
    }

    const modules = Object.hasOwn(declared.moderator, module)
      ? declared.moderator[module]
      : undefined;

    if (!modules?.some(candidate => candidate.permission === permission)) {
      throw new EditablePageRegistryError(
        `The editable page "${entry.page.id}" is edited with the moderator permission "${permission}" of "${plugin}"'s "${module}" module, which "${plugin}" never declares. Add \`permissionStaff: { moderator: { ${JSON.stringify(module)}: [${JSON.stringify(permission)}] } }\` to its API config: a permission the AdminCP cannot offer is a permission nobody holds, so the page would be editable by root roles alone and every other save would be a 403.`,
      );
    }
  }
};
