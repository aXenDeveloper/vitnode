"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

// The panel fetches a record's whole URL history, so it is loaded when the dialog
// is - the same treatment the edit form and the revision history get, and the
// reason a 25-row table costs one button rather than 25 queries.
const DeliveryPanel = dynamic(async () =>
  import("./delivery/delivery-panel").then(mod => ({
    default: mod.DeliveryPanel,
  })),
);

/**
 * The delivery row action: canonical URL, publication state, historical URLs.
 *
 * Listed for `can_view`, and for nothing else. It reports what the slug mutations
 * already did, so the permission that allowed the mutation is the only one it
 * needs - a `can_manage_redirects` for a read-only screen would be a permission
 * every install has to configure for no decision it can make.
 */
export const DeliveryContentPanel = ({
  contentTypeId,
  id,
  locale,
  singular,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  id: number;
  /** The language whose URLs to show, when the list is viewed in one. */
  locale?: string;
  singular: string;
}) => {
  const t = useTranslations("core.content.delivery");

  return (
    <ContentPanel
      description={t("desc")}
      title={t("title", { name: singular })}
      {...panel}
    >
      <DeliveryPanel contentTypeId={contentTypeId} id={id} locale={locale} />
    </ContentPanel>
  );
};
