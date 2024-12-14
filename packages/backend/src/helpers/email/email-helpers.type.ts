// import { UploadCoreFilesObj } from '@/core/files/helpers/upload/upload.dto';
import React from 'react';
import { FileObj } from 'vitnode-shared/utils/files.dto';

import { EmailTemplateProps } from './template/email-template';

export interface EmailHelpersServiceType {
  getHelpersForEmail: () => GetHelpersForEmailType;
  template: (
    props: Omit<EmailTemplateProps, 'helpers'>,
  ) => Promise<React.JSX.Element>;
}

export interface EmailSenderArgs {
  html: string;
  site_short_name: string;
  subject: string;
  to: string;
}

export type EmailSenderFunction = (params: EmailSenderArgs) => Promise<void>;

export interface GetHelpersForEmailType {
  backend_url: string;
  color_primary: string;
  color_primary_foreground: string;
  contact_email: string;
  frontend_url: string;
  logo: null | Omit<FileObj, 'secure'>;
  site_name: string;
  site_short_name: string;
}
