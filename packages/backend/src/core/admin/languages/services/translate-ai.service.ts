import { ABSOLUTE_PATHS } from '@/app.module';
import { AiHelperService } from '@/helpers/ai.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateText } from 'ai';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class TranslateAiLanguagesAdminService {
  constructor(
    private readonly aiHelper: AiHelperService,
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async translateAi(code: string) {
    if (code === 'en') {
      throw new BadRequestException('Cannot translate to English');
    }

    const language =
      await this.databaseService.db.query.core_languages.findFirst({
        where: (table, { eq }) => eq(table.code, code),
        columns: {
          code: true,
        },
      });
    if (!language) {
      throw new NotFoundException();
    }

    const model = this.aiHelper.getModel();
    if (!model) {
      throw new BadRequestException('AI model not found');
    }

    const plugins = await this.databaseService.db.query.core_plugins.findMany({
      columns: {
        code: true,
      },
    });

    await Promise.all(
      [...plugins, { code: 'core' }, { code: 'admin' }].map(async plugin => {
        const pluginLangPath = ABSOLUTE_PATHS.plugin({ code: plugin.code })
          .frontend.languages;
        const langPath = join(pluginLangPath, 'en.json');
        if (!existsSync(langPath)) {
          return;
        }

        const textLang = JSON.parse(await readFile(langPath, 'utf-8'));
        const { text } = await generateText({
          model,
          prompt: `You are a professional translator in JSON format.
    
          Task: Translate the content below from en to ${code}.
          Only translate the untranslated parts. If the content is already translated, leave it as is.
    
          Translation Requirements:
          - Do not translate the code,
          - Maintain exact file structure, indentation, and formatting,
          - Preserve all object/property keys, syntax characters, and punctuation marks exactly,
          - Keep consistent capitalization, spacing, and line breaks,
          - Provide natural, culturally-adapted translations that sound native,
          - Match source file's JSON/object structure precisely,
          - Wrap return JSON in \`\`\`json code block.
    
          Source content (en):
          ${JSON.stringify(textLang, null, 2)}
    
          Return the same content with identical structure after translation.
          `,
        });

        const cleanedText = text
          .replace(/^```json\n?/, '')
          .replace(/\n?```$/, '');
        await writeFile(
          join(pluginLangPath, `${code}.json`),
          JSON.stringify(JSON.parse(cleanedText), null, 2),
        );
      }),
    );
  }
}
