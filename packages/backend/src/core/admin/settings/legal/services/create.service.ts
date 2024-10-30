import { core_legal } from '@/database/schema/legal';
import { removeSpecialCharacters } from '@/functions';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { CreateLegalBody, Legal } from 'vitnode-shared/legal.dto';

@Injectable()
export class CreateLegalSettingsAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async create({
    title,
    content,
    href,
    code,
  }: CreateLegalBody): Promise<Legal> {
    const termExist = await this.databaseService.db.query.core_legal.findFirst({
      where: (table, { eq }) => eq(table.code, code),
    });

    if (termExist) {
      throw new ConflictException('LEGAL_ALREADY_EXISTS');
    }

    const [term] = await this.databaseService.db
      .insert(core_legal)
      .values({ href, code: removeSpecialCharacters(code) })
      .returning();

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
