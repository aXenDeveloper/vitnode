import { core_legal } from '@/database/schema/legal';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Legal } from 'vitnode-shared/legal.dto';

@Injectable()
export class ItemLegalService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async item(code: string): Promise<Legal> {
    const term = await this.databaseService.db.query.core_legal.findFirst({
      where: (table, { eq }) => eq(table.code, code),
      columns: {
        id: true,
        code: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!term) {
      throw new NotFoundException();
    }

    const i18n = await this.stringLanguageHelper.get({
      item_ids: [term.id],
      database: core_legal,
      plugin_code: 'core',
      variables: ['title', 'content'],
    });

    return {
      ...term,
      title: i18n
        .filter(value => value.variable === 'title')
        .map(value => ({
          value: value.value,
          language_code: value.language_code,
        })),
      content: i18n
        .filter(value => value.variable === 'content')
        .map(value => ({
          value: value.value,
          language_code: value.language_code,
        })),
    };
  }
}
