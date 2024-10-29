import { core_users } from '@/database/schema/users';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { User } from 'vitnode-shared/user.dto';

@Injectable()
export class DeleteUsersMembersAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async delete({
    id,
    user: currentUser,
  }: {
    id: number;
    user: User;
  }): Promise<void> {
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        id: true,
        group_id: true,
      },
    });

    if (!user) {
      throw new NotFoundException();
    }

    if (currentUser.id === id) {
      throw new ForbiddenException('DELETE_YOURSELF');
    }

    const admin =
      await this.databaseService.db.query.core_admin_permissions.findFirst({
        where: (table, { or, eq }) =>
          or(eq(table.user_id, user.id), eq(table.group_id, user.group_id)),
      });

    if (admin) {
      throw new ForbiddenException('DELETE_ADMIN');
    }

    await this.databaseService.db
      .delete(core_users)
      .where(eq(core_users.id, id));
  }
}
