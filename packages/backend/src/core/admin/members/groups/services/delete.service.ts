import { core_groups } from '@/database/schema/groups';
import { core_users } from '@/database/schema/users';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DeleteGroupsMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async delete(id: number): Promise<void> {
    const group = await this.databaseService.db.query.core_groups.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        id: true,
        root: true,
        protected: true,
        default: true,
        guest: true,
      },
    });

    if (!group) {
      throw new NotFoundException();
    }

    if (group.root || group.protected || group.default || group.guest) {
      throw new ForbiddenException();
    }

    // Find default group
    const defaultGroup =
      await this.databaseService.db.query.core_groups.findFirst({
        where: (table, { eq }) => eq(table.default, true),
        columns: {
          id: true,
        },
      });

    if (!defaultGroup) {
      throw new InternalServerErrorException('Default group not found');
    }

    // Move users to default group
    await this.databaseService.db
      .update(core_users)
      .set({
        group_id: defaultGroup.id,
      })
      .where(eq(core_users.group_id, id));

    // Delete group
    await this.databaseService.db
      .delete(core_groups)
      .where(eq(core_groups.id, id));

    await this.stringLanguageHelper.delete({
      database: core_groups,
      item_id: group.id,
      plugin_code: 'core',
    });
  }
}
