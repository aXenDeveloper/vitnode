import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserMembersAdmin } from 'vitnode-shared/admin/members/users.dto';

@Injectable()
export class ItemUsersMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly userHelper: UserHelper,
  ) {}

  async item(id: number): Promise<UserMembersAdmin> {
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        id: true,
        email: true,
        email_verified: true,
        joined_at: true,
        newsletter: true,
      },
    });
    if (!user) {
      throw new NotFoundException();
    }

    const userFromHelper = await this.userHelper.getUserById({
      id: user.id,
      withDangerousData: true,
    });

    if (!userFromHelper) {
      throw new NotFoundException();
    }

    return { ...userFromHelper, ...user };
  }
}
