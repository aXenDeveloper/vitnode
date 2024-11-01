import { core_files, core_files_using } from '@/database/schema/files';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { DeleteFilesQuery } from 'vitnode-shared/files.dto';
import { User } from 'vitnode-shared/user.dto';

@Injectable()
export class DeleteFilesService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly filesService: FilesHelperService,
  ) {}

  async delete({
    query: { file_id, security_key },
    user,
  }: {
    query: DeleteFilesQuery;
    user: User;
  }): Promise<string> {
    const findFile = await this.databaseService.db.query.core_files.findFirst({
      where: (table, { eq }) => eq(table.id, file_id),
    });

    if (
      !findFile ||
      findFile.user_id !== user.id ||
      (findFile.security_key && findFile.security_key !== security_key)
    ) {
      throw new ForbiddenException();
    }

    const [uses] = await this.databaseService.db
      .select({
        count: count(),
      })
      .from(core_files_using)
      .where(eq(core_files_using.file_id, file_id));

    if (uses.count > 0) {
      return 'Skipped! File is being used';
    }

    await this.filesService.delete({
      dir_folder: findFile.dir_folder,
      file_name: findFile.file_name,
      secure: !!findFile.security_key,
    });

    await Promise.all([
      this.databaseService.db
        .delete(core_files_using)
        .where(eq(core_files_using.file_id, file_id)),
      this.databaseService.db
        .delete(core_files)
        .where(eq(core_files.id, file_id)),
    ]);

    return 'File deleted successfully';
  }
}
