import { core_config } from '@/database/schema/config';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { EditorStylesAdminBody } from 'vitnode-shared/admin/styles/editor.dto';

@Injectable()
export class EditorStylesAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async editor(data: EditorStylesAdminBody): Promise<EditorStylesAdminBody> {
    const [config] = await this.databaseService.db
      .update(core_config)
      .set({
        editor_sticky: data.sticky,
      })
      .returning();

    return {
      sticky: config.editor_sticky,
    };
  }
}
