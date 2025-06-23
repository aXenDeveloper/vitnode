import { CONFIG_PLUGIN } from '../../../../config';
import { buildModule } from '../../../lib/module';
import { logsDebugAdminRoute } from './routes/logs.route';

export const debugAdminModule = buildModule({
  ...CONFIG_PLUGIN,
  name: 'debug',
  routes: [logsDebugAdminRoute],
});
