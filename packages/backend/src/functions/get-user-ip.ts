import { Request } from 'express';

export const getUserIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].toString()
      : req.socket.remoteAddress) ?? 'IP Not Found'
  );
};
