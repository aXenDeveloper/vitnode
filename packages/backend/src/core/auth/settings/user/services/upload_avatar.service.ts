import { core_files_avatars } from '@/database/schema/users';
import { FilesHelperService } from '@/helpers/files/files-helper.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { UploadAvatarUserSettingsAuthBody } from 'vitnode-shared/auth/settings/user.dto';
import { User } from 'vitnode-shared/user.dto';

@Injectable()
export class UploadAvatarUserSettingsAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly filesHelper: FilesHelperService,
  ) {}

  async uploadAvatar({
    body: { delete_avatar },
    currentUser,
    files: { avatar },
  }: {
    body: Omit<UploadAvatarUserSettingsAuthBody, 'avatar'>;
    currentUser: User;
    files: Pick<UploadAvatarUserSettingsAuthBody, 'avatar'>;
  }): Promise<void> {
    if (!delete_avatar && !avatar) {
      throw new BadRequestException('No avatar provided');
    }

    const avatarFromDB =
      await this.databaseService.db.query.core_files_avatars.findFirst({
        where: (table, { eq }) => eq(table.user_id, currentUser.id),
      });

    if (avatarFromDB || (delete_avatar && avatarFromDB)) {
      await this.filesHelper.delete({
        dir_folder: avatarFromDB.dir_folder,
        file_name: avatarFromDB.file_name,
      });

      await this.databaseService.db
        .delete(core_files_avatars)
        .where(eq(core_files_avatars.user_id, currentUser.id));

      if (delete_avatar) return;
    }

    const file = await this.filesHelper.upload({
      file: avatar,
      folder: 'avatars',
      plugin_code: 'core',
    });

    await this.databaseService.db.insert(core_files_avatars).values({
      ...file,
      user_id: currentUser.id,
    });
  }
}
