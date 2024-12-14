import { core_files } from '@/database/schema/files';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DeleteFilesAdvancedAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly filesService: FilesHelperService,
  ) {}

  async delete(id: number): Promise<void> {
    const findFile = await this.databaseService.db.query.core_files.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: {
        id: true,
        dir_folder: true,
        file_name: true,
      },
    });

    if (!findFile) {
      throw new NotFoundException();
    }

    await this.filesService.delete(findFile);

    await this.databaseService.db
      .delete(core_files)
      .where(eq(core_files.id, id));
  }
}
