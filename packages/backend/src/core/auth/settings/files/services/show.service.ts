import { core_files, core_files_using } from '@/database/schema/files';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { and, count, eq, ilike, or } from 'drizzle-orm';
import {
  ShowFilesSettingsAuthObj,
  ShowFilesSettingsAuthQuery,
} from 'vitnode-shared/auth/settings/files.dto';
import { User } from 'vitnode-shared/user.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class ShowFilesSettingsAuthServices {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async show({
    query: { cursor, first, last, search = '', sortBy, sortDirection },
    user,
  }: {
    query: ShowFilesSettingsAuthQuery;
    user: User;
  }): Promise<ShowFilesSettingsAuthObj> {
    const where = and(
      eq(core_files.user_id, user.id),
      or(
        ilike(core_files.file_name_original, `%${search}%`),
        ilike(core_files.file_name, `%${search}%`),
        ilike(core_files.file_alt, `%${search}%`),
      ),
    );

    const pagination = await this.databaseService.paginationCursor({
      cursor,
      database: core_files,
      first,
      last,
      primaryCursor: 'id',
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'created_at',
      },
      sortBy,
      sortDirection,
      where,
      query: async args =>
        await this.databaseService.db.query.core_files.findMany(args),
    });

    const edges: ShowFilesSettingsAuthObj['edges'] = await Promise.all(
      pagination.edges.map(async edge => {
        const [countFileUsing] = await this.databaseService.db
          .select({
            count: count(),
          })
          .from(core_files_using)
          .where(eq(core_files_using.file_id, edge.id));

        return {
          ...edge,
          count_uses: countFileUsing.count,
        };
      }),
    );

    return { ...pagination, edges };
  }
}
