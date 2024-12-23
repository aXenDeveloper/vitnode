import { core_users_sso } from '@/database/schema/users';
import { SSOAuthConfig, SSOAuthHelper } from '@/helpers/auth/sso/sso.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
} from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class CreateMethodsAuthSettingsAdminService {
  constructor(
    private readonly ssoAuthHelper: SSOAuthHelper,
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async create({
    code,
    client_id,
    client_secret,
  }: CreateMethodAuthSettingsAdminBody): Promise<ShowMethodAuthSettingsAdmin> {
    const sso = this.ssoAuthHelper.getSSO(code);
    if (!sso) {
      throw new NotFoundException(`SSO method with ${code} code not found`);
    }

    const dataSSO: SSOAuthConfig['sso'][0] = {
      client_id,
      client_secret,
      code,
      enabled: true,
    };

    const ssoConfig =
      await this.databaseService.db.query.core_users_sso.findMany();
    const checkIfSSOExists = ssoConfig.find(item => item.code === code);
    if (checkIfSSOExists) {
      throw new ConflictException(
        `SSO method with ${code} code already exists`,
      );
    }

    await this.databaseService.db.insert(core_users_sso).values({
      code,
      client_id,
      client_secret,
      enabled: true,
    });

    return {
      ...dataSSO,
      name: sso.name,
    };
  }
}
