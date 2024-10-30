import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { BadRequestException, Injectable } from '@nestjs/common';

export const acceptMimeTypeImage = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

export const acceptMimeTypeVideo = ['video/mp4', 'video/webm', 'video/ogg'];

@Injectable()
export class FilesHelperService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async upload({
    files,
    plugin_code,
  }: {
    files: Express.Multer.File[];
    plugin_code: string;
  }) {
    const pluginExists =
      await this.databaseService.db.query.core_plugins.findFirst({
        where: (table, { eq }) => eq(table.code, plugin_code),
        columns: {
          code: true,
        },
      });

    if (!pluginExists && plugin_code !== 'core') {
      throw new BadRequestException(`Plugin "${plugin_code}" does not exist`);
    }
  }
}
