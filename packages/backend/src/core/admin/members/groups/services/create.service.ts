import { core_groups } from '@/database/schema/groups';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import {
  CreateGroupsMembersAdminBody,
  GroupMembersAdmin,
} from 'vitnode-shared/admin/members/groups.dto';

@Injectable()
export class CreateGroupsMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async create({
    name,
    content,
    color,
  }: CreateGroupsMembersAdminBody): Promise<GroupMembersAdmin> {
    const [group] = await this.databaseService.db
      .insert(core_groups)
      .values({
        ...content,
        color: color ? color : null,
      })
      .returning();

    const groupNames = await this.stringLanguageHelper.parse({
      item_id: group.id,
      plugin_code: 'core',
      database: core_groups,
      data: name,
      variable: 'name',
    });

    return {
      users_count: 0,
      updated_at: group.updated_at,
      root: false,
      id: group.id,
      protected: false,
      guest: false,
      default: false,
      created_at: group.created_at,
      content: {
        files_allow_upload: group.files_allow_upload,
        files_max_storage_for_submit: group.files_max_storage_for_submit,
        files_total_max_storage: group.files_total_max_storage,
      },
      color: group.color,
      name: groupNames,
    };
  }
}
