import { core_groups } from '@/database/schema/groups';
import { core_users } from '@/database/schema/users';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import {
  CreateGroupsMembersAdminBody,
  GroupMembersAdmin,
} from 'vitnode-shared/admin/members/groups.dto';

@Injectable()
export class EditGroupsMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async edit({
    id,
    body: { name, content, color },
  }: {
    body: CreateGroupsMembersAdminBody;
    id: number;
  }): Promise<GroupMembersAdmin> {
    const group = await this.databaseService.db.query.core_groups.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        id: true,
      },
    });

    if (!group) {
      throw new NotFoundException();
    }

    const [[groupUpdate], [usersCount], groupNames] = await Promise.all([
      this.databaseService.db
        .update(core_groups)
        .set({
          updated_at: new Date(),
          color: color ? color : null,
          ...content,
        })
        .where(eq(core_groups.id, group.id))
        .returning(),
      this.databaseService.db
        .select({ count: count() })
        .from(core_users)
        .where(eq(core_users.group_id, id)),
      this.stringLanguageHelper.parse({
        item_id: group.id,
        plugin_code: 'core',
        database: core_groups,
        data: name,
        variable: 'name',
      }),
    ]);

    return {
      users_count: usersCount.count,
      updated_at: groupUpdate.updated_at,
      root: groupUpdate.root,
      id: groupUpdate.id,
      protected: groupUpdate.protected,
      guest: groupUpdate.guest,
      default: groupUpdate.default,
      created_at: groupUpdate.created_at,
      content: {
        files_allow_upload: groupUpdate.files_allow_upload,
        files_max_storage_for_submit: groupUpdate.files_max_storage_for_submit,
        files_total_max_storage: groupUpdate.files_total_max_storage,
      },
      color: groupUpdate.color,
      name: groupNames,
    };
  }
}
