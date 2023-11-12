import * as fs from 'fs';
import { join } from 'path';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';
import { CustomError } from '@/utils/errors/CustomError';
import { ConfigType } from '@/types/config.type';
import { AccessDeniedError } from '@/utils/errors/AccessDeniedError';
import { currentDate } from '@/functions/date';

@Injectable()
export class CreateDatabaseAdminInstallService {
  constructor(private prisma: PrismaService) {}

  protected throwError() {
    throw new CustomError({
      code: 'DATABASE_ALREADY_EXISTS',
      message: 'Database already exists.'
    });
  }

  async create(): Promise<string> {
    const configFile = fs.readFileSync(join('..', 'config.json'), 'utf8');
    const config: ConfigType = JSON.parse(configFile);

    if (config.finished_install) {
      throw new AccessDeniedError();
    }

    // Create default language
    const languageCount = await this.prisma.core_languages.count();
    if (languageCount > 0) {
      this.throwError();
    }

    await this.prisma.core_languages.createMany({
      data: [
        {
          id: 'en',
          name: 'English',
          default: true,
          protected: true,
          timezone: 'America/New_York',
          created: currentDate()
        },
        { id: 'pl', name: 'Polski (Polish)', timezone: 'Europe/Warsaw', created: currentDate() }
      ]
    });

    // Create default groups
    const groupCount = await this.prisma.core_groups.count();
    if (groupCount > 0) {
      this.throwError();
    }

    await this.prisma.core_groups.createMany({
      data: [
        {
          id: 1,
          name: 'Guest',
          created: currentDate(),
          protected: true
        },
        {
          id: 2,
          name: 'Moderator',
          created: currentDate(),
          protected: true
        },
        {
          id: 3,
          name: 'Member',
          created: currentDate(),
          protected: true
        },
        {
          id: 4,
          name: 'Administrator',
          created: currentDate(),
          protected: true
        }
      ]
    });

    // Create default permissions for admin
    const permissionCount = await this.prisma.core_admin_access.count();
    if (permissionCount > 0) {
      this.throwError();
    }

    await this.prisma.core_admin_access.create({
      data: {
        group_id: 4,
        permissions: '*',
        created: currentDate()
      }
    });

    return 'Success!';
  }
}