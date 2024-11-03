import React from 'react';
import { LanguagesAdminObj } from 'vitnode-shared/admin/language.dto';

import { DeleteActionsTableLangsCoreAdmin } from './delete/delete';
import { EditActionsTableLangsCoreAdmin } from './edit';

export const ActionsTableLangsCoreAdmin = (data: LanguagesAdminObj) => {
  return (
    <>
      <EditActionsTableLangsCoreAdmin {...data} />
      {!data.protected && !data.default && (
        <DeleteActionsTableLangsCoreAdmin {...data} />
      )}
    </>
  );
};
