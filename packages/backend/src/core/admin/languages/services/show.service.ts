import { core_languages } from '@/database/schema/languages';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { ilike } from 'drizzle-orm';
import {
  ShowLanguagesAdminObj,
  ShowLanguagesAdminQuery,
} from 'vitnode-shared/admin/language.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class ShowLanguagesAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async show({
    first,
    last,
    cursor,
    search = '',
    sortBy,
    sortDirection,
  }: ShowLanguagesAdminQuery): Promise<ShowLanguagesAdminObj> {
    const where = ilike(core_languages.name, `%${search}%`);

    return await this.databaseService.paginationCursor({
      cursor,
      database: core_languages,
      first,
      last,
      sortBy,
      sortDirection,
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'created_at',
      },
      where,
      query: async args =>
        this.databaseService.db.query.core_languages.findMany(args),
    });
  }
}
