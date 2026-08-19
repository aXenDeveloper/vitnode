import { CallbackSSOView } from "@vitnode/core/views/auth/sso/callback/callback-sso-view";

export const instant = false;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { providerId } = await params;
  const currentSearchParams = await searchParams;

  return (
    <CallbackSSOView
      providerId={providerId}
      searchParams={currentSearchParams}
    />
  );
}
