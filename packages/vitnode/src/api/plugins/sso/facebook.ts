import { getRedirectUri, SSOApiPlugin } from '@/api/models/sso';
import { HTTPException } from 'hono/http-exception';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

export const FacebookSSOApiPlugin = ({
  clientId,
  clientSecret,
}: {
  clientId: string | undefined;
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = 'facebook';
  const redirectUri = getRedirectUri(id);
  const tokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
  });
  const userSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  });

  return {
    id,
    name: 'Facebook',
    fetchToken: async code => {
      if (!clientId || !clientSecret) {
        throw new Error('Missing Facebook client ID or secret');
      }

      const url = new URL(
        'https://graph.facebook.com/v22.0/oauth/access_token',
      );
      url.searchParams.set('code', code);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('client_secret', clientSecret);
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new HTTPException(
          +res.status.toString() as ContentfulStatusCode,
          {
            message: 'Internal error requesting token',
          },
        );
      }

      const { data, error } = tokenSchema.safeParse(await res.json());
      if (error || !data) {
        throw new HTTPException(400, {
          message: 'Invalid token response',
        });
      }

      return data;
    },

    fetchUser: async ({ access_token }) => {
      const url = new URL('https://graph.facebook.com/v22.0/me');
      url.searchParams.set('fields', 'id,name,email');
      url.searchParams.set('access_token', access_token);
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new HTTPException(
          +res.status.toString() as ContentfulStatusCode,
          {
            message: 'Internal error requesting user',
          },
        );
      }
      const { data: userData, error: userError } = userSchema.safeParse(
        await res.json(),
      );
      if (userError || !userData) {
        throw new HTTPException(400, {
          message: 'Invalid user response',
        });
      }

      return { ...userData, username: userData.name };
    },

    getUrl: ({ state }) => {
      if (!clientId) {
        throw new Error('Missing Facebook client ID');
      }

      const url = new URL('https://www.facebook.com/v22.0/dialog/oauth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', 'public_profile,email');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('state', state);

      return url.toString();
    },
  };
};
