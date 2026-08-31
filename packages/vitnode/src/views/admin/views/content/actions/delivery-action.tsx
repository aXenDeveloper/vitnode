"use client";

import React from "react";
import { useTranslations } from "use-intl";

import type { ContentPanelProps } from "./content-panel";

import { ContentPanel } from "./content-panel";

// The panel fetches a record's whole URL history, so it is loaded when the dialog
// is - the same treatment the edit form and the revision history get, and the
// reason a 25-row table costs one button rather than 25 queries.
const DeliveryPanel = React.lazy(
  async () =>
    await import("./delivery/delivery-panel").then(mod => ({
      default: mod.DeliveryPanel,
    })),
);

export const DeliveryContentPanel = ({
  contentTypeId,
  id,
  locale,
  singular,
  ...panel
}: ContentPanelProps & {
  contentTypeId: string;
  id: number;
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
