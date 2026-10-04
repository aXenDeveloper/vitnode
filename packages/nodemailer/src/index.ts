import type { EmailApiPlugin } from "@vitnode/core/api/models/email";

import { createTransport } from "nodemailer";

export const NodemailerEmailAdapter = ({
  host = "",
  port = 587,
  secure = false,
  user = "",
  password = "",
  from = "",
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
        throw new Error("Missing nodemailer configuration");
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

      const info = await transporter.sendMail({
        to,
        subject,
        html,
      });

      // SMTP has no idempotency: a crash after the server accepted a message
      // and before this returned can mean a retry delivers it twice.
      return {
        id: typeof info.messageId === "string" ? info.messageId : undefined,
      };
    },
  };
};
