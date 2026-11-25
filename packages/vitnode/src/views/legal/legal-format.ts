import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";

import { useFormatter } from "use-intl";

/** Long date and time for legal dates, in the viewer's language. */
export const useLegalDate = () => {
  const format = useFormatter();

  return (value: Date | string): string =>
    format.dateTime(typeof value === "string" ? new Date(value) : value, {
      dateStyle: "long",
      timeStyle: "short",
    });
};

/** Public path of a document type's page, without a locale prefix. */
export const legalBasePath = (documentType: LegalDocumentType) =>
  documentType === "terms" ? "/terms" : "/privacy";
