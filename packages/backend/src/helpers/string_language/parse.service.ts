import { core_files_using } from '@/database/schema/files';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { and, inArray } from 'drizzle-orm';

interface StringLanguageJSONContentType {
  attrs?: { dir_folder?: string; id: number };
  content?: StringLanguageJSONContentType[];
  type: string;
}

interface InfoType {
  files: { folder: string; id: number }[];
}

export class ParseStringLanguageHelper {
  constructor(protected databaseService: InternalDatabaseService) {}

  private getInfoFromContent(content: string): InfoType {
    const files: InfoType['files'] = [];

    const mapContent = (values: StringLanguageJSONContentType[]) => {
      values.forEach(value => {
        if (!value.attrs) return;

        // Get all file ids
        if (
          value.type === 'files' &&
          !files.find(file => file.id === value.attrs?.id) &&
          value.attrs.dir_folder
        ) {
          const folder = value.attrs.dir_folder.split('/').at(-1);
          if (!folder) return;

          files.push({
            id: value.attrs.id,
            folder,
          });
        }

        if (value.content) {
          mapContent(value.content);
        }
      });
    };

    try {
      const json = JSON.parse(content)
        .content as StringLanguageJSONContentType[];

      mapContent(json);
    } catch (_) {
      // Skip if content is not JSON
    }

    return { files };
  }

  private async parseFiles({
    oldFilesId,
    newFilesId,
    plugin_code,
  }: {
    newFilesId: InfoType['files'];
    oldFilesId: InfoType['files'];
    plugin_code: string;
  }) {
    const filesIdsToAdd = newFilesId.filter(id => {
      return !oldFilesId.find(oldId => oldId.id === id.id);
    });
    const filesIdsToRemove = oldFilesId.filter(id => {
      return !newFilesId.find(newId => newId.id === id.id);
    });

    if (filesIdsToAdd.length) {
      await this.databaseService.db.insert(core_files_using).values(
        filesIdsToAdd.map(file => ({
          file_id: file.id,
          plugin: plugin_code,
          folder: file.folder,
        })),
      );
    }

    // Remove using files only if record exists
    if (filesIdsToRemove.length) {
      const files =
        await this.databaseService.db.query.core_files_using.findMany({
          where: (table, { inArray }) =>
            inArray(
              table.file_id,
              filesIdsToRemove.map(file => file.id),
            ),
          limit: filesIdsToRemove.length,
          columns: {
            id: true,
            folder: true,
          },
        });
      if (!files.length) return;

      await this.databaseService.db.delete(core_files_using).where(
        and(
          inArray(
            core_files_using.id,
            files.map(file => file.id),
          ),
          inArray(core_files_using.plugin, [plugin_code]),
          inArray(
            core_files_using.folder,
            files.map(file => file.folder),
          ),
        ),
      );
    }
  }

  private removeDuplicates(data: Pick<InfoType, 'files'>[]) {
    return data.reduce(
      (acc, item) => {
        item.files.forEach(file => {
          if (!acc.files.find(accFile => accFile.id === file.id)) {
            acc.files.push(file);
          }
        });

        return acc;
      },
      { files: [] },
    );
  }

  async parseContent({
    oldContent,
    content,
    plugin_code,
  }: {
    content: string[];
    oldContent: string[];
    plugin_code: string;
  }) {
    const oldData = this.removeDuplicates(
      oldContent.map(content => this.getInfoFromContent(content)),
    );
    const newData = this.removeDuplicates(
      content.map(content => this.getInfoFromContent(content)),
    );

    await this.parseFiles({
      oldFilesId: oldData.files,
      newFilesId: newData.files,
      plugin_code,
    });
  }
}
