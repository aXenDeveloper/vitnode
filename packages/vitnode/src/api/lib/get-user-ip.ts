import { HonoRequest } from 'hono';

export const getUserIp = (req: HonoRequest): string => {
  const ip: string = req.header('x-forwarded-for')?.toString() ?? '0.0.0.0';

  if (ip === '0.0.0.0') {
    // eslint-disable-next-line no-console
    console.error(
      '\x1b[31m[VitNode]\x1b[31m No IP found in request. Please check if you passed `x-forwarded-for` header.\x1b[0m',
    );
  }

  return ip;
};
