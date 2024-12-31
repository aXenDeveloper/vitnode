import { core_files, core_files_using } from '@/database/schema/files';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, isNull, lte } from 'drizzle-orm';

@Injectable()
export class FilesCron {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly filesService: FilesHelperService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS, {
    name: 'core_clear_unused_files',
  })
  async clearUnusedFiles() {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const findFiles = await this.databaseService.db
      .select()
      .from(core_files)
      .leftJoin(core_files_using, eq(core_files.id, core_files_using.file_id))
      .where(
        and(
          isNull(core_files_using.file_id),
          lte(core_files.created_at, twelveHoursAgo),
        ),
      );

    await Promise.all(
      findFiles.map(async file => {
        await Promise.all([
          this.filesService.delete({
            dir_folder: file.core_files.dir_folder,
            file_name: file.core_files.file_name,
          }),
          this.databaseService.db
            .delete(core_files)
            .where(eq(core_files.id, file.core_files.id)),
        ]);
      }),
    );
  }
}
