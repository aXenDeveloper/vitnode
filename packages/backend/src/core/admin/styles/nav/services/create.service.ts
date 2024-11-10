import { core_nav } from '@/database/schema/nav';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { CreateNavStylesAdminBody } from 'vitnode-shared/admin/styles/nav.dto';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

@Injectable()
export class CreateNavStylesAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async create({
    description,
    external,
    href,
    name,
  }: CreateNavStylesAdminBody): Promise<ShowNavStyles> {
    const theMostHighestPosition =
      await this.databaseService.db.query.core_nav.findFirst({
        where: (table, { eq }) => eq(table.parent_id, 0),
        orderBy: (table, { desc }) => desc(table.position),
      });

    const [nav] = await this.databaseService.db
      .insert(core_nav)
      .values({
        href,
        external,
        position: theMostHighestPosition
          ? theMostHighestPosition.position + 1
          : 0,
      })
      .returning();

    const namesNav = await this.stringLanguageHelper.parse({
      item_id: nav.id,
      plugin_code: 'core',
      database: core_nav,
      data: name,
      variable: 'name',
    });

    const descriptionNav = await this.stringLanguageHelper.parse({
      item_id: nav.id,
      plugin_code: 'core',
      database: core_nav,
      data: description,
      variable: 'description',
    });

    return {
      ...nav,
      name: namesNav,
      description: descriptionNav,
      children: [],
    };
  }
}
