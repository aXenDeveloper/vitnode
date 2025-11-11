import type { EmailApiPlugin } from "@vitnode/core/api/models/email";

import { Resend } from "resend";

export const ResendEmailAdapter = ({
  apiKey,
  from,
}: {
  apiKey: string | undefined;
  from: string | undefined;
}): EmailApiPlugin => {
  return {
    sendEmail: async ({ to, subject, replyTo, metadata, html }) => {
      if (!(apiKey && from)) {
        throw new Error("Missing Resend configuration");
      }

      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: `${metadata.shortTitle ?? metadata.title} <${from}>`,
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
