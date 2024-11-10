import { core_users } from '@/database/schema/users';
import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, ilike, inArray, or, SQL } from 'drizzle-orm';
import {
  UsersMembersAdminObj,
  UsersMembersAdminQuery,
} from 'vitnode-shared/admin/members/users.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class GetUsersMembersAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly userHelper: UserHelper,
  ) {}

  async get({
    cursor,
    first,
    last,
    sortBy,
    search,
    groups,
    sortDirection,
  }: UsersMembersAdminQuery): Promise<UsersMembersAdminObj> {
    let where: SQL | undefined;

    if (search) {
      where = or(
        ilike(core_users.name, `%${search}%`),
        ilike(core_users.email, `%${search}%`),
        Number(search) ? eq(core_users.id, Number(search)) : undefined,
      );
    }

    if (groups && groups.length > 0) {
      where = and(where, inArray(core_users.group_id, groups));
    }

    const pagination = await this.databaseService.paginationCursor({
      cursor,
      database: core_users,
      first,
      last,
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'joined_at',
      },
      sortBy,
      sortDirection,
      where,
      query: async args =>
        await this.databaseService.db.query.core_users.findMany({
          ...args,
          columns: {
            email: true,
            id: true,
            newsletter: true,
            joined_at: true,
            email_verified: true,
          },
        }),
    });

    return {
      ...pagination,
      edges: await Promise.all(
        pagination.edges.map(async edge => {
          const user = await this.userHelper.getUserById({
            id: edge.id,
          });

          if (!user) {
            throw new InternalServerErrorException();
          }

          return {
            ...user,
            ...edge,
          };
        }),
      ),
    };
  }
}
