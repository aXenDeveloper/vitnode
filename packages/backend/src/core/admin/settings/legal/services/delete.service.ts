import { core_legal } from '@/database/schema/legal';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DeleteLegalSettingsAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async delete(code: string): Promise<void> {
    const term = await this.databaseService.db.query.core_legal.findFirst({
      where: (table, { eq }) => eq(table.code, code),
      columns: {
        id: true,
      },
    });

    if (!term) {
      throw new NotFoundException();
    }

    await this.stringLanguageHelper.delete({
      database: core_legal,
      item_id: term.id,
      plugin_code: 'core',
    });

    await this.databaseService.db
      .delete(core_legal)
      .where(eq(core_legal.id, term.id));
  }
}
