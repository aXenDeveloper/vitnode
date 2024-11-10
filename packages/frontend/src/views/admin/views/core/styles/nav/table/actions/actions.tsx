import { ShowNavStyles } from 'vitnode-shared/nav.dto';

import { DeleteActionTableNavAdmin } from './delete/delete';
import { EditActionTableNavAdmin } from './edit';

export const ActionsTableNavAdmin = (props: ShowNavStyles) => {
  return (
    <div className="flex gap-1">
      <EditActionTableNavAdmin {...props} />
      <DeleteActionTableNavAdmin {...props} />
    </div>
  );
};
