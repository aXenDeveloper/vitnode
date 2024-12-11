import * as admins from './schema/admins.js';
import * as files from './schema/files.js';
import * as groups from './schema/groups.js';
import * as languages from './schema/languages.js';
import * as legal from './schema/legal.js';
import * as logs from './schema/logs.js';
import * as moderators from './schema/moderators.js';
import * as nav from './schema/nav.js';
import * as plugins from './schema/plugins.js';
import * as sessions from './schema/sessions.js';
import * as users from './schema/users.js';

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
