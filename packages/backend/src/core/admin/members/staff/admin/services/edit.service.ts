import { core_admin_permissions } from '@/database/schema/admins';
import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  AdminStaffMembersAdmin,
  EditAdminStaffMembersAdminBody,
} from 'vitnode-shared/admin/members/staff/admin.dto';
import { PermissionsStaffObjWithoutPluginName } from 'vitnode-shared/admin/staff.dto';

@Injectable()
export class EditAdminStaffMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly userHelper: UserHelper,
  ) {}

  async edit({
    body: { permissions },
    id,
  }: {
    body: EditAdminStaffMembersAdminBody;
    id: number;
  }): Promise<AdminStaffMembersAdmin> {
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

    await this.databaseService.db
      .update(core_admin_permissions)
      .set({
        permissions,
      })
      .where(eq(core_admin_permissions.id, id));

    const data =
      await this.databaseService.db.query.core_admin_permissions.findFirst({
        where: (table, { eq }) => eq(table.id, id),
        with: {
          group: {
            columns: {
              id: true,
              color: true,
            },
          },
        },
      });

    if (!data) {
      throw new InternalServerErrorException();
    }

    if (data.user_id) {
      const user = await this.userHelper.getUserById({
        id: data.user_id,
      });

      if (!user) {
        throw new InternalServerErrorException();
      }

      return {
        ...data,
        user_or_group: {
          ...user,
        },
        permissions: data.permissions as PermissionsStaffObjWithoutPluginName[],
      };
    }

    if (!data.group) {
      throw new InternalServerErrorException();
    }

    return {
      ...data,
      user_or_group: {
        ...data.group,
        group_name: [],
      },
      permissions: data.permissions as PermissionsStaffObjWithoutPluginName[],
    };
  }
}
