// import { UploadCoreFilesObj } from '@/core/files/helpers/upload/upload.dto';
import React from 'react';

import { EmailTemplateProps } from './template/email-template';

export interface GetHelpersForEmailType {
  backend_url: string;
  color: {
    background: string;
    border: string;
    card: string;
    foreground: string;
    muted: {
      DEFAULT: string;
      foreground: string;
    };
    primary: {
      DEFAULT: string;
      foreground: string;
    };
  };
  contact_email: string;
  frontend_url: string;
  // logo?: UploadCoreFilesObj;
  site_name: string;
  site_short_name: string;
}

export interface EmailHelpersServiceType {
  getHelpersForEmail: () => GetHelpersForEmailType;
  template: (props: Omit<EmailTemplateProps, 'helpers'>) => React.JSX.Element;
}

export interface EmailSenderArgs {
  html: string;
  site_short_name: string;
  subject: string;
  to: string;
}

export type EmailSenderFunction = (params: EmailSenderArgs) => Promise<void>;
