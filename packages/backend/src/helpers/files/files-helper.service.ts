import { ABSOLUTE_PATHS } from '@/app.module';
import { removeSpecialCharacters } from '@/functions';
import { generateRandomString } from '@/functions/generate-random-string';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { FileObj } from 'vitnode-shared/utils/files.dto';

export const acceptMimeTypeImage = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

export const acceptMimeTypeVideo = ['video/mp4', 'video/webm', 'video/ogg'];

@Injectable()
export class FilesHelperService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async delete({
    secure,
    dir_folder,
    file_name,
  }: {
    dir_folder: string;
    file_name: string;
    secure?: boolean;
  }) {
    const privateOrPublicFolder = secure
      ? ABSOLUTE_PATHS.uploads.secure
      : ABSOLUTE_PATHS.uploads.public;
    const path = join(privateOrPublicFolder, dir_folder, file_name);

    if (!existsSync(path)) {
      throw new BadRequestException('File not found');
    }

    await unlink(path);
  }

  async upload({
    file,
    plugin_code,
    folder,
    secure = false,
  }: {
    file: Express.Multer.File;
    folder: string;
    plugin_code: string;
    secure?: boolean;
  }): Promise<FileObj> {
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

    // Create folders
    const date = new Date();
    const privateOrPublicFolder = secure
      ? ABSOLUTE_PATHS.uploads.secure
      : ABSOLUTE_PATHS.uploads.public;
    const dirFolder = join(
      `monthly_${date.getMonth() + 1}_${date.getFullYear()}`,
      plugin_code,
      folder,
    );

    if (!existsSync(dirFolder)) {
      await mkdir(join(privateOrPublicFolder, dirFolder), {
        recursive: true,
      });
    }

    const extension = file.originalname.split('.').pop();
    if (!extension) {
      throw new BadRequestException('File extension not found');
    }
    const fileName = `${Date.now()}_${generateRandomString(5)}_${removeSpecialCharacters(
      file.originalname.replace(`.${extension}`, ''),
    ).replace(/\./g, '')}.${extension}`;
    const pathToSaveFile = join(privateOrPublicFolder, dirFolder, fileName);
    await writeFile(pathToSaveFile, file.buffer);

    const returnValues: FileObj = {
      mimetype: file.mimetype,
      file_name: fileName,
      file_name_original: file.originalname,
      dir_folder: dirFolder,
      extension,
      file_size: file.size,
      secure,
      width: null,
      height: null,
    };

    if (acceptMimeTypeImage.includes(file.mimetype)) {
      const file = await readFile(pathToSaveFile);
      const image = await sharp(file).metadata();

      return {
        ...returnValues,
        width: image.width ?? null,
        height: image.height ?? null,
      };
    }

    return returnValues;
  }
}
