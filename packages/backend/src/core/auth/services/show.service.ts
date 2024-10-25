import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ShowAuthObj } from 'vitnode-shared/auth.dto';

@Injectable()
export class ShowAuthService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async show(): Promise<ShowAuthObj> {
    const plugin = await this.databaseService.db.query.core_plugins.findFirst({
      where: (table, { eq }) => eq(table.default, true),
    });
    if (!plugin) {
      throw new HttpException('Plugin not found', HttpStatus.NOT_FOUND);
    }

    return {
      plugin_code_default: plugin.code,
    };
  }
}
