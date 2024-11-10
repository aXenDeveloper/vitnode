import { configPath, getConfigFile } from '@/helpers/config';
import { Injectable } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { EditorStylesAdminBody } from 'vitnode-shared/admin/styles/editor.dto';

@Injectable()
export class EditorStylesAdminService {
  async editor(data: EditorStylesAdminBody): Promise<EditorStylesAdminBody> {
    const config = getConfigFile();

    config.editor = {
      ...config.editor,
      ...data,
    };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    return config.editor;
  }
}
