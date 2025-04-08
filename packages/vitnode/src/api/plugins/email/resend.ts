import { EmailApiPlugin } from '@/api/models/email';
import { Resend } from 'resend';

export const ResendEmailPlugin = ({
  apiKey,
  from,
}: {
  apiKey: string | undefined;
  from: string | undefined;
}): EmailApiPlugin => {
  return {
    sendEmail: async ({ to, subject, replyTo, site, html }) => {
      if (!apiKey || !from) {
        throw new Error('Missing Resend configuration');
      }

      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: `${site.nameShort ?? site.name} <${from}>`,
        to,
        subject,
        replyTo,
        html,
      });

      if (error) {
        throw new Error(`[${error.name}]: ${error.message}`);
      }
    },
  };
};
