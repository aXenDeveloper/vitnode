import { core_users } from '@/database/schema/users';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class ConfirmEmailUsersMembersAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async confirmEmail(id: number): Promise<void> {
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        id: true,
        email_verified: true,
      },
    });

    if (!user || user.email_verified) {
      throw new NotFoundException();
    }

    await this.databaseService.db
      .update(core_users)
      .set({ email_verified: true })
      .where(eq(core_users.id, id));
  }
}
