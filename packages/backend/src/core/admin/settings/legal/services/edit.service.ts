import { core_legal } from '@/database/schema/legal';
import { removeSpecialCharacters } from '@/functions';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CreateLegalSettingsAdminBody } from 'vitnode-shared/admin/settings/legal.dto';
import { Legal } from 'vitnode-shared/legal.dto';

@Injectable()
export class EditLegalSettingsAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async edit({
    title,
    content,
    href,
    code,
    id,
  }: CreateLegalSettingsAdminBody & { id: number }): Promise<Legal> {
    const term = await this.databaseService.db.query.core_legal.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    });

    if (!term) {
      throw new NotFoundException();
    }

    const termExist = await this.databaseService.db.query.core_legal.findFirst({
      where: (table, { eq }) => eq(table.code, code),
    });

    if (termExist && termExist.code !== term.code) {
      throw new ConflictException('LEGAL_ALREADY_EXISTS');
    }

    await this.databaseService.db
      .update(core_legal)
      .set({
        href,
        updated_at: new Date(),
        code: removeSpecialCharacters(code),
      })
      .where(eq(core_legal.id, id));

    const titleTerm = await this.stringLanguageHelper.parse({
      item_id: term.id,
      plugin_code: 'core',
      database: core_legal,
      data: title,
      variable: 'title',
    });

    const contentTerm = await this.stringLanguageHelper.parse({
      item_id: term.id,
      plugin_code: 'core',
      database: core_legal,
      data: content,
      variable: 'content',
    });

    return {
      ...term,
      title: titleTerm,
      content: contentTerm,
    };
  }
}
