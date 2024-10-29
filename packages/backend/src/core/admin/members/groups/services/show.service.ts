import { core_groups } from '@/database/schema/groups';
import { core_users } from '@/database/schema/users';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { count, eq, inArray, SQL } from 'drizzle-orm';
import {
  GroupsMembersAdminObj,
  GroupsMembersAdminQuery,
} from 'vitnode-shared/admin/members/groups.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class ShowGroupsMembersAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async show({
    first,
    last,
    cursor,
    search,
    sortBy,
    sortDirection,
  }: GroupsMembersAdminQuery): Promise<GroupsMembersAdminObj> {
    let where: SQL | undefined;

    if (search) {
      const searchByLang =
        await this.databaseService.db.query.core_languages_words.findMany({
          where: (table, { eq, and, ilike }) =>
            and(
              eq(table.plugin_code, 'core'),
              eq(table.table_name, 'core_groups'),
              eq(table.variable, 'name'),
              ilike(table.value, `%${search}%`),
            ),
          columns: {
            item_id: true,
          },
          limit: last ?? first ?? 10,
        });

      where = inArray(
        core_groups.id,
        searchByLang.map(({ item_id }) => item_id),
      );
    }

    const pagination = await this.databaseService.paginationCursor({
      cursor,
      database: core_groups,
      first,
      last,
      where,
      sortBy,
      sortDirection,
      primaryCursor: 'id',
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'updated_at',
      },
      query: async args =>
        await this.databaseService.db.query.core_groups.findMany({
          ...args,
          with: {
            name: {
              columns: {
                value: true,
                language_code: true,
              },
            },
          },
        }),
    });

    const edges: GroupsMembersAdminObj['edges'] = await Promise.all(
      pagination.edges.map(async edge => {
        const [usersCount] = await this.databaseService.db
          .select({ count: count() })
          .from(core_users)
          .where(eq(core_users.group_id, edge.id));

        return {
          ...edge,
          users_count: usersCount.count,
          content: {
            files_allow_upload: edge.files_allow_upload,
            files_max_storage_for_submit: edge.files_max_storage_for_submit,
            files_total_max_storage: edge.files_total_max_storage,
          },
        };
      }),
    );

    return {
      ...pagination,
      edges,
    };
  }
}
