import type { EmailApiPlugin } from "@vitnode/core/api/models/email";
import type { Transporter } from "nodemailer";

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
  // One pooled transport per adapter: SMTP connections (and their TLS
  // handshakes) are reused across sends instead of opened for every email.
  let transporter: null | Transporter = null;
  const getTransporter = (): Transporter => {
    transporter ??= createTransport({
      pool: true,
      maxConnections: 5,
      host,
      port,
      secure,
      auth: {
        user,
        pass: password,
      },
    });

    return transporter;
  };

  return {
    sendEmail: async ({ metadata, to, subject, html, text, replyTo }) => {
      if (!(host && user && password && from)) {
        throw new Error("Missing nodemailer configuration");
      }

      const info = await getTransporter().sendMail({
        from: {
          name: metadata.shortTitle ?? metadata.title,
          address: from,
        },
        replyTo,
        to,
        subject,
        html,
        text,
      });

      return { id: info.messageId };
    },
  };
};
