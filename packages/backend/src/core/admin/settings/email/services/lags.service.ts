import { core_logs_email } from '@/database/schema/logs';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import {
  LogsEmailSettingsAdminObj,
  LogsEmailSettingsAdminQuery,
} from 'vitnode-shared/admin/settings/email.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class LogsEmailSettingsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async logs({
    cursor,
    first,
    last,
  }: LogsEmailSettingsAdminQuery): Promise<LogsEmailSettingsAdminObj> {
    return await this.databaseService.paginationCursor({
      cursor,
      database: core_logs_email,
      first,
      last,
      defaultSortBy: {
        column: 'created_at',
        direction: SortDirectionEnum.desc,
      },
      query: async args =>
        await this.databaseService.db.query.core_logs_email.findMany(args),
    });
  }
}
