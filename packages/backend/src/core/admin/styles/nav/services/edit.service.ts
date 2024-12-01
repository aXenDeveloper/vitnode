import { core_nav } from '@/database/schema/nav';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CreateNavStylesAdminBody } from 'vitnode-shared/admin/styles/nav.dto';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

@Injectable()
export class EditNavStylesAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async edit({
    id,
    body: { description, external, href, name },
  }: {
    body: CreateNavStylesAdminBody;
    id: number;
  }): Promise<ShowNavStyles> {
    const nav = await this.databaseService.db.query.core_nav.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    });

    if (!nav) {
      throw new NotFoundException();
    }

    const [updatedNav] = await this.databaseService.db
      .update(core_nav)
      .set({
        href,
        external,
        last_updated: new Date(),
      })
      .where(eq(core_nav.id, id))
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

    const children = await this.databaseService.db.query.core_nav.findMany({
      where: (table, { eq }) => eq(table.parent_id, id),
    });

    const childrenI18n = await this.stringLanguageHelper.get({
      plugin_code: 'core',
      item_ids: [id],
      database: core_nav,
      variables: ['name', 'description'],
    });

    return {
      ...updatedNav,
      name: namesNav,
      description: descriptionNav,
      children: children.map(child => ({
        ...child,
        name: childrenI18n.filter(
          item => item.item_id === child.id && item.variable === 'name',
        ),
        description: childrenI18n.filter(
          item => item.item_id === child.id && item.variable === 'description',
        ),
      })),
    };
  }
}
