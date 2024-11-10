import { core_admin_permissions } from '@/database/schema/admins';
import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  AdminStaffMembersAdmin,
  CreateAdminStaffMembersAdminBody,
} from 'vitnode-shared/admin/members/staff/admin.dto';
import { PermissionsStaffObjWithoutPluginName } from 'vitnode-shared/admin/staff.dto';

@Injectable()
export class CreateAdminStaffMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly userHelper: UserHelper,
  ) {}

  async create({
    group_id,
    permissions,
    user_id,
  }: CreateAdminStaffMembersAdminBody): Promise<AdminStaffMembersAdmin> {
    if (!group_id && !user_id) {
      throw new BadRequestException('group_id or user_id is required');
    }

    const findPermission =
      await this.databaseService.db.query.core_admin_permissions.findFirst({
        where: (table, { eq, or }) =>
          or(
            user_id ? eq(table.user_id, user_id) : undefined,
            group_id ? eq(table.group_id, group_id) : undefined,
          ),
      });

    if (findPermission) {
      throw new ConflictException('ALREADY_EXISTS');
    }

    const [permission] = await this.databaseService.db
      .insert(core_admin_permissions)
      .values({
        user_id,
        group_id,
        permissions,
      })
      .returning();

    const data =
      await this.databaseService.db.query.core_admin_permissions.findFirst({
        where: (table, { eq }) => eq(table.id, permission.id),
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
