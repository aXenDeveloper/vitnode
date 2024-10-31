import { core_users } from '@/database/schema/users';
import { getUserIp, removeSpecialCharacters } from '@/functions';
import { getConfigFile } from '@/helpers/config';
import { EmailHelperService } from '@/helpers/email/email.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { Request } from 'express';
import { SignUpAuthBody } from 'vitnode-shared/auth.dto';

import { generateAvatarColor } from '../../helpers/avatar-color';
import { encryptPassword } from '../../helpers/password';

@Injectable()
export class HelperSignUpAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly mailService: EmailHelperService,
  ) {}

  private readonly getDefaultData = async (): Promise<{
    email_verified: boolean;
    group_id: number;
  }> => {
    const [countUsers] = await this.databaseService.db
      .select({ count: count() })
      .from(core_users);

    // If no users, return root group
    if (countUsers.count === 0) {
      const rootGroup =
        await this.databaseService.db.query.core_groups.findFirst({
          where: (table, { and, eq }) =>
            and(eq(table.default, false), eq(table.root, true)),
        });

      if (!rootGroup) {
        throw new HttpException('ROOT_GROUP_NOT_FOUND', HttpStatus.NOT_FOUND);
      }

      return {
        group_id: rootGroup.id,
        email_verified: true,
      };
    }

    const defaultGroup =
      await this.databaseService.db.query.core_groups.findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.default, true), eq(table.root, false)),
      });

    if (!defaultGroup) {
      throw new HttpException('DEFAULT_GROUP_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    return {
      group_id: defaultGroup.id,
      email_verified: false,
    };
  };

  private readonly getLanguage = async (req: Request): Promise<string> => {
    const languageToSet: string =
      (Array.isArray(req.headers['x-vitnode-user-language'])
        ? req.headers['x-vitnode-user-language'][0]
        : req.headers['x-vitnode-user-language']) ?? 'en';

    // Check if language exists
    const lang = await this.databaseService.db.query.core_languages.findMany({
      columns: {
        code: true,
        default: true,
      },
    });

    if (!lang.find(l => l.code === languageToSet)) {
      return lang.find(l => l.default)?.code ?? 'en';
    }

    return languageToSet;
  };

  async signUp({
    req,
    body: { email: emailRaw, name, newsletter, password },
  }: {
    body: SignUpAuthBody;
    req: Request;
  }) {
    const email = emailRaw.toLowerCase();
    const checkEmail = await this.databaseService.db.query.core_users.findFirst(
      {
        where: (table, { eq }) => eq(table.email, email),
      },
    );

    if (checkEmail) {
      throw new HttpException('EMAIL_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    const convertToNameSEO = removeSpecialCharacters(name);
    const checkNameSEO =
      await this.databaseService.db.query.core_users.findFirst({
        where: (table, { ilike }) => ilike(table.name_seo, convertToNameSEO),
      });

    if (checkNameSEO) {
      throw new HttpException('NAME_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    const hashPassword = await encryptPassword(password);
    const config = getConfigFile();

    const { group_id, email_verified } = await this.getDefaultData();

    const user = await this.databaseService.db
      .insert(core_users)
      .values({
        email,
        name,
        name_seo: convertToNameSEO,
        newsletter,
        password: hashPassword,
        avatar_color: generateAvatarColor(name),
        group_id,
        email_verified:
          config.settings.authorization.require_confirm_email &&
          this.mailService.checkIfEnable()
            ? email_verified
            : true,
        ip_address: getUserIp(req),
        language: await this.getLanguage(req),
      })
      .returning();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...rest } = user[0];

    return { ...rest };
  }
}
