import { core_users_sso } from '@/database/schema/users';
import { SSOAuthHelper } from '@/helpers/auth/sso/sso.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  EditMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
} from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class EditMethodsAuthSettingsAdminService {
  constructor(
    private readonly ssoAuthHelper: SSOAuthHelper,
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async edit({
    code,
    body: { client_id, client_secret, enabled },
  }: {
    body: EditMethodAuthSettingsAdminBody;
    code: string;
  }): Promise<ShowMethodAuthSettingsAdmin> {
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

    const [data] = await this.databaseService.db
      .update(core_users_sso)
      .set({
        client_id,
        client_secret,
        enabled,
      })
      .where(eq(core_users_sso.code, code))
      .returning();

    return {
      ...data,
      name: sso.name,
    };
  }
}
