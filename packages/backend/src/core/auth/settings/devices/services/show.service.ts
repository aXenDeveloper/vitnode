import {
  core_sessions,
  core_sessions_known_devices,
} from '@/database/schema/sessions';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { ShowDevicesSettingsAuthObj } from 'vitnode-shared/auth/settings/devices.dto';
import { User } from 'vitnode-shared/user.dto';

@Injectable()
export class ShowDevicesSettingsAuthService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async show(user: User): Promise<ShowDevicesSettingsAuthObj[]> {
    const edges = await this.databaseService.db
      .select()
      .from(core_sessions)
      .rightJoin(
        core_sessions_known_devices,
        eq(core_sessions.device_id, core_sessions_known_devices.id),
      )
      .where(eq(core_sessions.user_id, user.id))
      .orderBy(desc(core_sessions_known_devices.last_seen));

    return edges.map(item => ({
      ...item.core_sessions_known_devices,
      // Force cast to object, as we know it exists. Typescript doesn't.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ...item.core_sessions!,
    }));
  }
}
