import { MODERATION_PERMISSIONS } from "@/lib/moderation/const";

import type {
  PermissionStaffCatalogEntry,
  PermissionStaffConfig,
  PermissionStaffEntryInput,
} from "../permission-staff";
import type {
  ModerationScopeDefinition,
  RegisteredModerationScope,
} from "./scopes";
import type {
  ModerationReportTargetDefinition,
  RegisteredReportTarget,
} from "./targets";

import { ModerationRegistryError } from "./scopes";

/** The `moderation` option of `buildApiPlugin`. */
export interface ModerationPluginConfig {
  /** Custom report targets; content types with `reports` add theirs automatically. */
  reportTargets?: ModerationReportTargetDefinition[];
  /** Scope families moderator permissions can be limited by. */
  scopes?: ModerationScopeDefinition[];
}

export interface ModerationRegistry {
  scopes: RegisteredModerationScope[];
  targets: RegisteredReportTarget[];
}

export const moderationPermissionEntries = (
  target: Pick<ModerationReportTargetDefinition, "actions" | "scope">,
): PermissionStaffEntryInput[] => {
  const scope = target.scope ? { scope: target.scope } : {};
  const hideable = Boolean(target.actions?.hide ?? target.actions?.unhide);

  return [
    { permission: MODERATION_PERMISSIONS.viewReports, ...scope },
    {
      dependsOn: [MODERATION_PERMISSIONS.viewReports],
      permission: MODERATION_PERMISSIONS.manageReports,
      ...scope,
    },
    {
      dependsOn: [MODERATION_PERMISSIONS.manageReports],
      permission: MODERATION_PERMISSIONS.editNotes,
      ...scope,
    },
    {
      dependsOn: [MODERATION_PERMISSIONS.manageReports],
      permission: MODERATION_PERMISSIONS.deleteNotes,
      ...scope,
    },
    ...(hideable
      ? [
          { permission: MODERATION_PERMISSIONS.viewHidden, ...scope },
          {
            dependsOn: [MODERATION_PERMISSIONS.viewHidden],
            permission: MODERATION_PERMISSIONS.hide,
            ...scope,
          },
        ]
      : []),
  ];
};

const permissionNameOf = (entry: PermissionStaffEntryInput): string =>
  typeof entry === "string" ? entry : entry.permission;

/**
 * Adds the report permissions of every target. A module the plugin declared
 * itself (`declared`) is left alone; a generated one - such as a content type's
 * `can_edit` - is merged with them instead of shadowing them.
 */
export const withModerationPermissions = (
  permissionStaff: PermissionStaffConfig | undefined,
  targets: readonly ModerationReportTargetDefinition[],
  declared?: ReadonlySet<string>,
): PermissionStaffConfig | undefined => {
  if (targets.length === 0) return permissionStaff;

  const moderator = { ...permissionStaff?.moderator };
  for (const target of targets) {
    const existing = moderator[target.permissionModule];
    if (existing && (declared?.has(target.permissionModule) ?? true)) continue;

    const taken = new Set((existing ?? []).map(permissionNameOf));
    moderator[target.permissionModule] = [
      ...(existing ?? []),
      ...moderationPermissionEntries(target).filter(
        entry => !taken.has(permissionNameOf(entry)),
      ),
    ];
  }

  return { ...permissionStaff, moderator };
};

export const validateModerationRegistry = ({
  catalog,
  scopes,
  targets,
}: {
  catalog: readonly PermissionStaffCatalogEntry[];
  scopes: readonly RegisteredModerationScope[];
  targets: readonly RegisteredReportTarget[];
}): ModerationRegistry => {
  const families = new Map<string, RegisteredModerationScope>();
  for (const entry of scopes) {
    const existing = families.get(entry.definition.id);
    if (existing) {
      throw new ModerationRegistryError(
        `Scope family "${entry.definition.id}" is registered by both ${existing.pluginId} and ${entry.pluginId}.`,
      );
    }
    families.set(entry.definition.id, entry);
  }

  for (const plugin of catalog) {
    for (const [module, entries] of Object.entries(plugin.admin)) {
      const scoped = entries.find(entry => entry.scope);
      if (scoped) {
        throw new ModerationRegistryError(
          `${plugin.pluginId}:${module}:${scoped.permission} is an admin permission with a scope. Only moderator permissions can be scoped.`,
        );
      }
    }
    for (const [module, entries] of Object.entries(plugin.moderator)) {
      for (const entry of entries) {
        if (entry.scope && !families.has(entry.scope)) {
          throw new ModerationRegistryError(
            `${plugin.pluginId}:${module}:${entry.permission} is scoped by "${entry.scope}", which no plugin registers with \`moderation.scopes\`.`,
          );
        }
      }
    }
  }

  const types = new Map<string, RegisteredReportTarget>();
  for (const entry of targets) {
    const existing = types.get(entry.definition.type);
    if (existing) {
      throw new ModerationRegistryError(
        `Report target "${entry.definition.type}" is registered by both ${existing.pluginId} and ${entry.pluginId}.`,
      );
    }
    if (entry.definition.scope && !families.has(entry.definition.scope)) {
      throw new ModerationRegistryError(
        `Report target "${entry.definition.type}" is scoped by "${entry.definition.scope}", which no plugin registers.`,
      );
    }
    types.set(entry.definition.type, entry);
  }

  return {
    scopes: [...families.values()],
    targets: [...types.values()].sort((a, b) =>
      a.definition.type.localeCompare(b.definition.type),
    ),
  };
};

export const findReportTarget = (
  registry: ModerationRegistry | undefined,
  { pluginId, type }: { pluginId: string; type: string },
): RegisteredReportTarget | undefined =>
  registry?.targets.find(
    entry => entry.pluginId === pluginId && entry.definition.type === type,
  );

export const findModerationScope = (
  registry: ModerationRegistry | undefined,
  family: string,
): RegisteredModerationScope | undefined =>
  registry?.scopes.find(entry => entry.definition.id === family);
