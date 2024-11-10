import * as admins from './schema/admins';
import * as files from './schema/files';
import * as groups from './schema/groups';
import * as languages from './schema/languages';
import * as legal from './schema/legal';
import * as logs from './schema/logs';
import * as moderators from './schema/moderators';
import * as nav from './schema/nav';
import * as plugins from './schema/plugins';
import * as sessions from './schema/sessions';
import * as users from './schema/users';

export default {
  ...groups,
  ...languages,
  ...legal,
  ...users,
  ...sessions,
  ...files,
  ...admins,
  ...moderators,
  ...plugins,
  ...nav,
  ...logs,
};
