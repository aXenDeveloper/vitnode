import { core_nav } from '@/database/schema/nav';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ChangePositionNavStylesAdminBody } from 'vitnode-shared/admin/styles/nav.dto';

@Injectable()
export class ChangePositionNavStylesAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async changePosition({
    id,
    index_to_move,
    parent_id,
  }: ChangePositionNavStylesAdminBody): Promise<void> {
    const nav = await this.databaseService.db.query.core_nav.findFirst({
      where: (table, { eq }) => eq(table.id, id),
    });

    if (!nav) {
      throw new NotFoundException();
    }

    const allChildrenParent =
      await this.databaseService.db.query.core_nav.findMany({
        where: (table, { eq }) => eq(table.parent_id, parent_id),
        orderBy: (table, { asc }) => asc(table.position),
      });

    let index = 0;
    const newChildrenIndexes: { id: number; position: number }[] = [];
    allChildrenParent
      .filter(item => item.id !== id)
      .forEach(item => {
        // Skip the item that we want to move
        if (index_to_move === index) {
          index++;
        }

        newChildrenIndexes.push({
          id: item.id,
          position: index,
        });
        index++;
      });

    // If index_to_move is below 0, it means that the item is at the end of the list
    newChildrenIndexes.push({
      id,
      position: index_to_move < 0 ? index : index_to_move,
    });

    await Promise.all(
      newChildrenIndexes.map(async item => {
        await this.databaseService.db
          .update(core_nav)
          .set({
            position: item.position,
            parent_id,
          })
          .where(eq(core_nav.id, item.id));
      }),
    );
  }
}
