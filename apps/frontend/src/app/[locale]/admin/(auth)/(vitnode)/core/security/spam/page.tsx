import { redirect } from 'vitnode-frontend/navigation';

export default async function Page() {
  await redirect('/admin/core/security/spam/captcha');
}
