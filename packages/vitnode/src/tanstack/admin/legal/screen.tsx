import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";
import { FileClockIcon, PencilLineIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  adminLegalDraftQueryOptions,
  adminLegalOverviewQueryOptions,
  adminLegalVersionQueryOptions,
  adminLegalVersionsQueryOptions,
  legalAdminQueryRoot,
} from "@/views/admin/views/core/system/legal/legal-admin-query";
import { LegalDraftEditor } from "@/views/admin/views/core/system/legal/legal-draft-editor";
import { LegalHistoryTable } from "@/views/admin/views/core/system/legal/legal-history-table";
import { LegalOverviewContent } from "@/views/admin/views/core/system/legal/legal-overview";
import { LegalVersionContent } from "@/views/admin/views/core/system/legal/legal-version-content";

import type {
  AdminLegalDocumentRouteData,
  AdminLegalRouteData,
  AdminLegalVersionRouteData,
} from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import { ADMIN_LEGAL_NAMESPACES, LEGAL_MODULE } from "./route";

const useLegalPermission = (
  permission: "can_edit" | "can_publish" | "can_view_records",
) =>
  useAdminPermission({ module: LEGAL_MODULE, permission, plugin: manifest.id });

export const AdminLegalRouteContent = ({
  description,
  title,
}: AdminLegalRouteData) => {
  const { data } = useSuspenseQuery(adminLegalOverviewQueryOptions());

  return (
    <RouteMessages namespaces={ADMIN_LEGAL_NAMESPACES}>
      <div className="p-6">
        <PageTitle desc={description} h1={title} />
        <LegalOverviewContent data={data} />
      </div>
    </RouteMessages>
  );
};

const DocumentTabs = ({
  documentType,
}: Pick<AdminLegalDocumentRouteData, "documentType">) => {
  const t = useTranslations("admin.system.legal");
  const queryClient = useQueryClient();
  const { data: context } = useSuspenseQuery(
    adminLegalDraftQueryOptions(documentType),
  );
  const { data: versions } = useSuspenseQuery(
    adminLegalVersionsQueryOptions(documentType),
  );
  const canEdit = useLegalPermission("can_edit");
  const canPublish = useLegalPermission("can_publish");

  return (
    <Tabs className="gap-4" defaultValue="draft">
      <TabsList>
        <TabsTrigger value="draft">
          <PencilLineIcon aria-hidden="true" />
          {t("tabs.draft")}
        </TabsTrigger>
        <TabsTrigger value="history">
          <FileClockIcon aria-hidden="true" />
          {t("tabs.history")}
        </TabsTrigger>
      </TabsList>
      <TabsPanels>
        <TabsContent value="draft">
          <LegalDraftEditor
            canEdit={canEdit}
            canPublish={canPublish}
            context={context}
            documentType={documentType}
            onChanged={async () => {
              await queryClient.invalidateQueries({
                queryKey: legalAdminQueryRoot,
              });
            }}
          />
        </TabsContent>
        <TabsContent value="history">
          <LegalHistoryTable items={versions.items} />
        </TabsContent>
      </TabsPanels>
    </Tabs>
  );
};

export const AdminLegalDocumentRouteContent = ({
  description,
  documentType,
  title,
}: AdminLegalDocumentRouteData) => (
  <RouteMessages namespaces={ADMIN_LEGAL_NAMESPACES}>
    <div className="p-6">
      <PageTitle desc={description} h1={title} />
      <DocumentTabs documentType={documentType} />
    </div>
  </RouteMessages>
);

const VersionBody = ({ id }: Pick<AdminLegalVersionRouteData, "id">) => {
  const { data } = useSuspenseQuery(adminLegalVersionQueryOptions(id));
  const canPublish = useLegalPermission("can_publish");
  const canViewRecords = useLegalPermission("can_view_records");

  return (
    <LegalVersionContent
      canPublish={canPublish}
      canViewRecords={canViewRecords}
      version={data}
    />
  );
};

export const AdminLegalVersionRouteContent = ({
  description,
  id,
  title,
}: AdminLegalVersionRouteData) => (
  <RouteMessages namespaces={ADMIN_LEGAL_NAMESPACES}>
    <div className="p-6">
      <PageTitle desc={description} h1={title} />
      <VersionBody id={id} />
    </div>
  </RouteMessages>
);
