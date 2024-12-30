import { core_logs } from '@/database/schema/logs';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import {
  ShowLogsAdminObj,
  ShowLogsAdminQuery,
} from 'vitnode-shared/admin/logs.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class ShowLogsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async show({
    cursor,
    first,
    last,
  }: ShowLogsAdminQuery): Promise<ShowLogsAdminObj> {
    const pagination = await this.databaseService.paginationCursor({
      cursor,
      first,
      last,
      database: core_logs,
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'created_at',
      },
      query: async args =>
        await this.databaseService.db.query.core_logs.findMany(args),
    });

    return {
      ...pagination,
      edges: pagination.edges.map(edge => ({
        ...edge,
        headers: JSON.stringify(edge.headers),
      })),
    };
  }
}
