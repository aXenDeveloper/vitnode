import { EmailApiPlugin } from '@/api/models/email';
import { createTransport } from 'nodemailer';

export const NodemailerEmailPlugin = ({
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
    sendEmail: async ({ site, to, subject, html, replyTo }) => {
      if (!host || !user || !password || !from) {
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
            name: site.nameShort ?? site.name,
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
