import { core_nav } from '@/database/schema/nav';
import { StringLanguageHelper } from '@/helpers/string_language/helpers.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

@Injectable()
export class NavMiddlewareService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly stringLanguageHelper: StringLanguageHelper,
  ) {}

  async show(): Promise<ShowNavStyles[]> {
    const data = await this.databaseService.db.query.core_nav.findMany({
      where: (table, { eq }) => eq(table.parent_id, 0),
      orderBy: (table, { asc }) => asc(table.position),
    });

    const ids = data.map(item => item.id);
    const i18n = await this.stringLanguageHelper.get({
      item_ids: ids,
      database: core_nav,
      plugin_code: 'core',
      variables: ['name', 'description'],
    });

    const edges: ShowNavStyles[] = await Promise.all(
      data.map(async item => {
        const children = await this.databaseService.db.query.core_nav.findMany({
          where: (table, { eq }) => eq(table.parent_id, item.id),
          orderBy: (table, { asc }) => asc(table.position),
        });
        const ids = children.map(child => child.id);
        const childrenI18n = await this.stringLanguageHelper.get({
          item_ids: ids,
          database: core_nav,
          plugin_code: 'core',
          variables: ['name', 'description'],
        });

        return {
          ...item,
          name: i18n.filter(
            i => i.item_id === item.id && i.variable === 'name',
          ),
          description: i18n.filter(
            i => i.item_id === item.id && i.variable === 'description',
          ),
          children: children.map(child => ({
            ...child,
            name: childrenI18n.filter(
              i => i.item_id === child.id && i.variable === 'name',
            ),
            description: childrenI18n.filter(
              i => i.item_id === child.id && i.variable === 'description',
            ),
          })),
        };
      }),
    );

    return edges;
  }
}
