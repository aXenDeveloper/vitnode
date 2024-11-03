'use client';

import { LogsEmailSettingsAdminObj } from 'vitnode-shared/admin/settings/email.dto';

import { ShowActionLogsEmailSettingsAdmin } from './show';

export const ActionsLogsEmailSettingsAdmin = (
  props: LogsEmailSettingsAdminObj['edges'][0],
) => {
  return <ShowActionLogsEmailSettingsAdmin {...props} />;
};
