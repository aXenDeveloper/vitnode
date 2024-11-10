import { type IOAuthGuards } from '@/guards/auth.guard';
import { getConfigFile } from '@/helpers/config';
import { UserHelper } from '@/helpers/user.service';
import { Inject, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { NavAuthAdminService } from './nav/nav.service';

@Injectable()
export class ShowAuthAdminService {
  constructor(
    @Inject('IOAdminAuthGuards') private readonly authService: IOAuthGuards,
    private readonly userHelper: UserHelper,
    private readonly navAdminService: NavAuthAdminService,
  ) {}

  private async getPackageJSON() {
    const packageJSONPath = join(__dirname, '../../../../../../package.json');
    if (!existsSync(packageJSONPath)) {
      throw new Error(`package.json not found in ${packageJSONPath}`);
    }
    const packageJSON: { version: string } = JSON.parse(
      await readFile(packageJSONPath, 'utf8'),
    );

    return packageJSON;
  }

  async show({
    req,
    res,
  }: {
    req: Request;
    res: Response;
  }): Promise<ShowAuthAdminObj> {
    const user = await this.authService.authorization({
      req,
      res,
    });
    const packageJSON = await this.getPackageJSON();
    const config = getConfigFile();

    return {
      user,
      version_of_vitnode: packageJSON.version,
      restart_server: config.restart_server,
      permissions: await this.userHelper.getUserAdminPermission({ user }),
      nav: await this.navAdminService.nav({ user }),
    };
  }
}
