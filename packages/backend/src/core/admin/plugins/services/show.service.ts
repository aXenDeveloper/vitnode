import { core_plugins } from '@/database/schema/plugins';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { ilike } from 'drizzle-orm';
import {
  ShowPluginsAdminObj,
  ShowPluginsAdminQuery,
} from 'vitnode-shared/admin/plugins.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class ShowPluginsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async show({
    first,
    last,
    cursor,
    search = '',
    sortBy,
    sortDirection,
  }: ShowPluginsAdminQuery): Promise<ShowPluginsAdminObj> {
    const where = ilike(core_plugins.name, `%${search}%`);

    return await this.databaseService.paginationCursor({
      cursor,
      database: core_plugins,
      first,
      last,
      sortBy,
      sortDirection,
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'updated_at',
      },
      where,
      query: async args =>
        await this.databaseService.db.query.core_plugins.findMany(args),
    });
  }
}
