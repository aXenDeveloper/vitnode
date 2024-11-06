import { core_files, core_files_using } from '@/database/schema/files';
import { UserHelper } from '@/helpers/user.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { count, eq, ilike, or } from 'drizzle-orm';
import {
  ShowFilesAdvancedAdminObj,
  ShowFilesAdvancedAdminQuery,
} from 'vitnode-shared/admin/advanced/files.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class ShowFilesAdvancedAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly userHelper: UserHelper,
  ) {}

  async show({
    cursor,
    first,
    last,
    search = '',
  }: ShowFilesAdvancedAdminQuery): Promise<ShowFilesAdvancedAdminObj> {
    const where = or(
      ilike(core_files.file_name_original, `%${search}%`),
      ilike(core_files.file_name, `%${search}%`),
      ilike(core_files.file_alt, `%${search}%`),
    );

    const pagination = await this.databaseService.paginationCursor({
      cursor,
      database: core_files,
      first,
      last,
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'created_at',
      },
      where,
      query: async args =>
        await this.databaseService.db.query.core_files.findMany(args),
    });

    const edges: ShowFilesAdvancedAdminObj['edges'] = await Promise.all(
      pagination.edges.map(async edge => {
        const [countFileUsing] = await this.databaseService.db
          .select({
            count: count(),
          })
          .from(core_files_using)
          .where(eq(core_files_using.file_id, edge.id));

        return {
          ...edge,
          secure: !!edge.security_key,
          user: edge.user_id
            ? await this.userHelper.getUserById({
                id: edge.user_id,
              })
            : null,
          count_uses: countFileUsing.count,
        };
      }),
    );

    return { ...pagination, edges };
  }
}
