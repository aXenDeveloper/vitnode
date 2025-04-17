import { createModuleApi } from '@/api/lib/module';
import { OpenAPIHono } from '@hono/zod-openapi';

import { sessionRoute } from './routes/session.route';
import { signInRoute } from './routes/sign-in.route';
import { signOutRoute } from './routes/sign-out.route';
import { signUpRoute } from './routes/sign-up.route';
import { ssoUserModule } from './sso/sso.module';

export const usersModule = createModuleApi({
  name: 'users',
  plugin: 'core',
  routes: new OpenAPIHono()
    .route('/sign_up', signUpRoute)
    .route('/sign_in', signInRoute)
    .route('/session', sessionRoute)
    .route('/sign_out', signOutRoute)
    .route('/sso', ssoUserModule.app),
});

export type UsersTypes = typeof usersModule;
