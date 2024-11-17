import { generateAvatarColor } from '@/core/auth/helpers/avatar-color';
import { core_users } from '@/database/schema/users';
import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  EditUserMembersAdminBody,
  UserMembersAdmin,
} from 'vitnode-shared/admin/members/users.dto';

@Injectable()
export class EditUsersMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly userHelper: UserHelper,
  ) {}

  async edit({
    id,
    body: { email, name, newsletter, group_id },
  }: {
    body: EditUserMembersAdminBody;
    id: number;
  }): Promise<UserMembersAdmin> {
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException();
    }

    const group = await this.databaseService.db.query.core_groups.findFirst({
      where: (table, { eq }) => eq(table.id, group_id),
      columns: {
        id: true,
      },
    });

    if (!group) {
      throw new NotFoundException('GROUP_NOT_FOUND');
    }

    const emailExists =
      await this.databaseService.db.query.core_users.findFirst({
        where: (table, { eq }) => eq(table.email, email),
      });

    if (emailExists && emailExists.id !== id) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    const [update] = await this.databaseService.db
      .update(core_users)
      .set({
        email,
        name,
        newsletter,
        avatar_color: generateAvatarColor(name),
        group_id,
      })
      .where(eq(core_users.id, id))
      .returning();

    const userForResponse = await this.userHelper.getUserById({
      id,
      withDangerousData: true,
    });

    if (!userForResponse) {
      throw new InternalServerErrorException();
    }

    return {
      ...userForResponse,
      joined_at: update.joined_at,
      email_verified: update.email_verified,
      newsletter: update.newsletter,
    };
  }
}
