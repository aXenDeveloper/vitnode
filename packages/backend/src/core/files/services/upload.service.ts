import { core_files } from '@/database/schema/files';
import { generateRandomString } from '@/functions/generate-random-string';
import {
  acceptMimeTypeImage,
  acceptMimeTypeVideo,
  FilesHelperService,
} from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { eq, sum } from 'drizzle-orm';
import { ShowFile, UploadFilesBody } from 'vitnode-shared/files.dto';
import { User } from 'vitnode-shared/user.dto';

@Injectable()
export class UploadFilesService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly filesService: FilesHelperService,
  ) {}

  protected acceptMimeTypeToFrontend = [
    ...acceptMimeTypeImage,
    ...acceptMimeTypeVideo,
  ];

  async upload({
    body: { file, folder, plugin_code },
    user,
  }: {
    body: UploadFilesBody;
    user: User;
  }): Promise<ShowFile> {
    // Check permission for upload files
    const findGroup = await this.databaseService.db.query.core_groups.findFirst(
      {
        where: (table, { eq }) => eq(table.id, user.group.id),
        columns: {
          files_allow_upload: true,
          files_max_storage_for_submit: true,
          files_total_max_storage: true,
        },
      },
    );

    if (!findGroup?.files_allow_upload) {
      throw new ForbiddenException('You are not allowed to upload files');
    }

    const countStorageUsed: number = user?.id
      ? +(
          (
            await this.databaseService.db
              .select({
                space_used: sum(core_files.file_size),
              })
              .from(core_files)
              .where(eq(core_files.user_id, user.id))
          )[0].space_used ?? 0
        )
      : 0;
    const remainingStorage =
      findGroup.files_total_max_storage !== 0
        ? findGroup.files_total_max_storage * 1024 - countStorageUsed
        : 0;
    const maxStorage = (() => {
      if (remainingStorage) {
        return findGroup.files_max_storage_for_submit
          ? Math.min(
              findGroup.files_max_storage_for_submit * 1024,
              remainingStorage,
            )
          : remainingStorage;
      }

      return findGroup.files_max_storage_for_submit * 1024 || -1;
    })();

    // Check if file size is greater than max storage
    if (file.size > maxStorage) {
      throw new ForbiddenException('File size is greater than max storage');
    }

    const uploadedFile = await this.filesService.upload({
      file,
      folder,
      plugin_code,
    });

    const securityKey = this.acceptMimeTypeToFrontend.includes(file.mimetype)
      ? null
      : generateRandomString(32);

    // Save to database
    const [data] = await this.databaseService.db
      .insert(core_files)
      .values({
        user_id: user.id,
        ...uploadedFile,
        security_key: securityKey,
      })
      .returning();

    return { ...data, count_uses: 0, secure: securityKey !== null };
  }
}
