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
import { TranslateAiLanguagesAdminBody } from 'vitnode-shared/admin/language.dto';

@Injectable()
export class TranslateAiLanguagesAdminService {
  constructor(
    private readonly aiHelper: AiHelperService,
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async translateAi({
    code,
    body: { plugins_code },
  }: {
    body: TranslateAiLanguagesAdminBody;
    code: string;
  }) {
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
      where: (table, { inArray }) =>
        plugins_code.length ? inArray(table.code, plugins_code) : undefined,
      columns: {
        code: true,
      },
    });

    const pluginsToTranslate = [
      ...plugins,
      { code: 'core' },
      { code: 'admin' },
    ].filter(plugin =>
      plugins_code.length ? plugins_code.includes(plugin.code) : plugin,
    );

    await Promise.all(
      pluginsToTranslate.map(async plugin => {
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

          Translation Requirements:
          - Do not translate the code,
          - Maintain exact file structure, indentation, and formatting,
          - Preserve all object/property keys, syntax characters, and punctuation marks exactly,
          - Keep consistent capitalization, spacing, and line breaks,
          - Match source file's JSON/object structure precisely,
          - Wrap return JSON in \`\`\`json code block.

          Important: Skip translation if is already translated (and not identical to source).

          Source content (en):
          ${JSON.stringify(textLang, null, 2)}

          Return the same content with identical structure after translation.
          `,
        });

        const cleanedText = text
          .replace(/^```json\n?/, '')
          .replace(/\n?```\s*$/, '');
        await writeFile(
          join(pluginLangPath, `${code}.json`),
          JSON.stringify(JSON.parse(cleanedText), null, 2),
        );
      }),
    );
  }
}
