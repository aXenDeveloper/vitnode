import { LogsAdminObj } from 'vitnode-shared/admin/logs.dto';

import { MoreActionsLogsDiagnosticTools } from './more';

export const ActionsLogsDiagnosticTools = (props: LogsAdminObj) => {
  return (
    <>
      <MoreActionsLogsDiagnosticTools {...props} />
    </>
  );
};
