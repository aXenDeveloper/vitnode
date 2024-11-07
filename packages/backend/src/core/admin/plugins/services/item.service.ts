import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

@Injectable()
export class ItemPluginsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async item(code: string): Promise<ShowPluginAdmin> {
    const plugin = await this.databaseService.db.query.core_plugins.findFirst({
      where: (table, { eq }) => eq(table.code, code),
    });

    if (!plugin) {
      throw new NotFoundException();
    }

    return plugin;
  }
}
