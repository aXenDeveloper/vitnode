import { core_admin_permissions } from '@/database/schema/admins';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DeleteAdminStaffMembersAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async delete(id: number): Promise<void> {
    const permission =
      await this.databaseService.db.query.core_admin_permissions.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        columns: {
          id: true,
          protected: true,
        },
      });

    if (!permission) {
      throw new NotFoundException();
    }

    if (permission.protected) {
      throw new ForbiddenException();
    }

    await this.databaseService.db
      .delete(core_admin_permissions)
      .where(eq(core_admin_permissions.id, id));
  }
}
