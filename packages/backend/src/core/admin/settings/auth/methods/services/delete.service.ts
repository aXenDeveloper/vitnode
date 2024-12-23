import { SSOAuthHelper } from '@/helpers/auth/sso/sso.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class DeleteMethodsAuthSettingsAdminService {
  constructor(
    private readonly ssoAuthHelper: SSOAuthHelper,
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async delete(code: string): Promise<void> {
    const sso = await this.ssoAuthHelper.getActiveSSO(code);
    if (!sso) {
      throw new NotFoundException(`SSO method with ${code} code not found`);
    }

    const ssoConfig =
      await this.databaseService.db.query.core_users_sso.findFirst({
        where: (table, { eq }) => eq(table.code, code),
      });
    if (!ssoConfig) {
      throw new NotFoundException(`SSO method with ${code} code not found`);
    }
  }
}
