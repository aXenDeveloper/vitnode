import { core_files } from '@/database/schema/files';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { eq, sum } from 'drizzle-orm';
import { PermissionsStaffObjWithoutPluginName } from 'vitnode-shared/admin/staff.dto';
import { User, UserWithDangerousInfo } from 'vitnode-shared/user.dto';

@Injectable()
export class UserHelper {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async getUserAdminPermission({
    user,
  }: {
    user: User;
  }): Promise<PermissionsStaffObjWithoutPluginName[]> {
    const admin =
      await this.databaseService.db.query.core_admin_permissions.findFirst({
        where: (table, { or, eq }) =>
          or(eq(table.user_id, user.id), eq(table.group_id, user.group.id)),
      });

    if (!admin) {
      throw new ForbiddenException();
    }

    return admin.permissions as PermissionsStaffObjWithoutPluginName[];
  }
  // Overload signatures
  async getUserById(params: {
    id: number;
    withDangerousData: true;
  }): Promise<null | UserWithDangerousInfo>;

  async getUserById(params: {
    id: number;
    withDangerousData?: false | undefined;
  }): Promise<null | User>;

  async getUserById({
    id,
    withDangerousData,
  }: {
    id: number;
    withDangerousData?: boolean;
  }): Promise<null | User | UserWithDangerousInfo> {
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        email: true,
        avatar_color: true,
        id: true,
        language: true,
        name: true,
        name_seo: true,
      },
      with: {
        avatar: true,
        group: {
          columns: {
            id: true,
            color: true,
            files_allow_upload: true,
            files_max_storage_for_submit: true,
            files_total_max_storage: true,
          },
        },
      },
    });
    if (!user) return null;

    const userGroupNames =
      await this.databaseService.db.query.core_languages_words.findMany({
        columns: {
          language_code: true,
          value: true,
        },
        where: (table, { eq, and }) =>
          and(
            eq(table.item_id, user.group.id),
            eq(table.plugin_code, 'core'),
            eq(table.variable, 'name'),
            eq(table.table_name, 'core_groups'),
          ),
      });

    const countStorageUsedDb = await this.databaseService.db
      .select({
        space_used: sum(core_files.file_size),
      })
      .from(core_files)
      .where(eq(core_files.user_id, user.id));
    const countStorageUsed = +(countStorageUsedDb[0].space_used ?? 0);

    const userReturnValues: User = {
      avatar_color: user.avatar_color,
      group: {
        color: user.group.color,
        id: user.group.id,
        name: userGroupNames,
      },
      id: user.id,
      language: user.language,
      name: user.name,
      name_seo: user.name_seo,
    };

    if (!withDangerousData) {
      return userReturnValues;
    }

    return {
      ...userReturnValues,
      email: user.email,
      files_permissions: {
        space_used: countStorageUsed,
        allow_upload: user.group.files_allow_upload,
        max_storage_for_submit: user.group.files_max_storage_for_submit
          ? user.group.files_max_storage_for_submit * 1024
          : user.group.files_max_storage_for_submit,
        total_max_storage: user.group.files_total_max_storage
          ? user.group.files_total_max_storage * 1024
          : user.group.files_total_max_storage,
      },
    };
  }
}
