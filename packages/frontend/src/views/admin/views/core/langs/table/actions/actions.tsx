import React from 'react';
import { LanguagesAdminObj } from 'vitnode-shared/admin/language.dto';

import { DeleteActionsTableLangsCoreAdmin } from './delete/delete';
import { EditActionsTableLangsCoreAdmin } from './edit';
import { TranslateAiActionTableLangsCoreAdmin } from './translate-ai/translate-ai';

export const ActionsTableLangsCoreAdmin = (data: LanguagesAdminObj) => {
  return (
    <>
      {data.code !== 'en' && <TranslateAiActionTableLangsCoreAdmin {...data} />}
      <EditActionsTableLangsCoreAdmin {...data} />
      {!data.protected && !data.default && (
        <DeleteActionsTableLangsCoreAdmin {...data} />
      )}
    </>
  );
};
