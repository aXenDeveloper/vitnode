import { createTransport } from 'nodemailer';

import type { EmailApiPlugin } from '@/api/models/email';

export const NodemailerEmailAdapter = ({
  host = '',
  port = 587,
  secure = false,
  user = '',
  password = '',
  from = '',
}: {
  from: string | undefined;
  host: string | undefined;
  password: string | undefined;
  port?: number;
  secure?: boolean;
  user: string | undefined;
}): EmailApiPlugin => {
  return {
    sendEmail: async ({ metadata, to, subject, html, replyTo }) => {
      if (!(host && user && password && from)) {
        throw new Error('Missing nodemailer configuration');
      }

      const transporter = createTransport(
        {
          host,
          port,
          secure,
          auth: {
            user,
            pass: password,
          },
        },
        {
          from: {
            name: metadata.shortTitle ?? metadata.title,
            address: from,
          },
          replyTo,
        },
      );

      await transporter.sendMail({
        to,
        subject,
        html,
      });
    },
  };
};
