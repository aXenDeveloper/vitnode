import { buildModule } from '@/api/lib/module';
import { testRoute } from './routes/test.route';

export const testModule = buildModule({
  name: 'test',
  plugin: 'core',
  routes: [testRoute],
});
