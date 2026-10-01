import { Skeleton } from "@/components/ui/skeleton";

import type {
  DisconnectSsoConnection,
  SaveSsoPreferences,
  StartSsoConnection,
} from "./sso-connections-mutations";
import type { SsoConnectionsApi } from "./sso-connections-query";
import type { SsoProfileSnapshot } from "./sso-fields-group";

import { normalizeSSOProviders } from "../../sso/providers";
import { SETTINGS_ROW, SettingsGroup } from "../settings-group";
import { SsoAccountsGroup } from "./sso-accounts-group";
import { SsoFieldsGroup } from "./sso-fields-group";
import { SsoSyncGroup } from "./sso-sync-group";

export const SsoConnectionsContent = ({
  data,
  onDisconnect,
  onSavePreferences,
  onStart,
  profile,
}: {
  data: SsoConnectionsApi;
  onDisconnect: DisconnectSsoConnection;
  onSavePreferences: SaveSsoPreferences;
  onStart: StartSsoConnection;
  profile: SsoProfileSnapshot;
}) => {
  const views = normalizeSSOProviders(
    data.providers.map(({ icon, id, name }) => ({ icon, id, name })),
  );

  return (
    <div className="flex flex-col gap-8">
      <SsoAccountsGroup
        data={data}
        onDisconnect={onDisconnect}
        onStart={onStart}
        views={views}
      />
      <SsoFieldsGroup
        data={data}
        onSavePreferences={onSavePreferences}
        profile={profile}
      />
      <SsoSyncGroup
        data={data}
        onSavePreferences={onSavePreferences}
        onStart={onStart}
      />
    </div>
  );
};

const SkeletonGroup = ({ rows }: { rows: number }) => (
  <div className="flex flex-col gap-2">
    <Skeleton className="mx-4 h-4 w-32" />
    <SettingsGroup>
      {Array.from({ length: rows }, (_, row) => (
        <li className={SETTINGS_ROW} key={row}>
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </li>
      ))}
    </SettingsGroup>
  </div>
);

export const SsoConnectionsSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-8">
    <SkeletonGroup rows={3} />
    <SkeletonGroup rows={3} />
  </div>
);
