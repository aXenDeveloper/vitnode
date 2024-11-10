import {
  CaptchaSpamSecurityAdminView,
  generateMetadataCaptchaSpamSecurityAdmin,
} from 'vitnode-frontend/views/admin/views/core/security/spam/captcha/captcha-spam-security-admin-view';

export const generateMetadata = generateMetadataCaptchaSpamSecurityAdmin;

export default function Page() {
  return <CaptchaSpamSecurityAdminView />;
}
