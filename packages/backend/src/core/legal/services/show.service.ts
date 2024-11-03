import { core_legal } from '@/database/schema/legal';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { LegalsObj, LegalsQuery } from 'vitnode-shared/legal.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

@Injectable()
export class ShowLegalService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async show({ cursor, first, last }: LegalsQuery): Promise<LegalsObj> {
    const pagination = await this.databaseService.paginationCursor({
      cursor,
      database: core_legal,
      first,
      last,
      defaultSortBy: {
        direction: SortDirectionEnum.desc,
        column: 'updated_at',
      },
      query: async args =>
        await this.databaseService.db.query.core_legal.findMany({
          ...args,
        }),
    });

    const ids = pagination.edges.map(edge => edge.id);
    const i18n = await this.stringLanguageHelper.get({
      item_ids: ids,
      database: core_legal,
      plugin_code: 'core',
      variables: ['title', 'content'],
    });

    const edges = pagination.edges.map(edge => {
      const currentI18n = i18n.filter(item => item.item_id === edge.id);

      return {
        ...edge,
        title: currentI18n
          .filter(value => value.variable === 'title')
          .map(value => ({
            value: value.value,
            language_code: value.language_code,
          })),
        content: currentI18n
          .filter(value => value.variable === 'content')
          .map(value => ({
            value: value.value,
            language_code: value.language_code,
          })),
      };
    });

    return { ...pagination, edges };
  }
}
