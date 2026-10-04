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
    sendEmail: async ({
      to,
      subject,
      replyTo,
      metadata,
      html,
      idempotencyKey,
    }) => {
      if (!(apiKey && from)) {
        throw new Error("Missing Resend configuration");
      }

      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send(
        {
          from: `${metadata.shortTitle ?? metadata.title} <${from}>`,
          to,
          subject,
          replyTo,
          html,
        },
        // Resend drops a second send with the same key for 24 hours, which is
        // what makes a retry after an unconfirmed send safe.
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      if (error) {
        throw new Error(`[${error.name}]: ${error.message}`);
      }

      return { id: data?.id };
    },
  };
};
