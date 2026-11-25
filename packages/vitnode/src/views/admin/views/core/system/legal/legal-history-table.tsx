import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLegalDate } from "@/views/legal/legal-format";

import type { AdminLegalVersionSummary } from "./legal-admin-query";

const STATUS_VARIANT = {
  current: "success",
  past: "secondary",
  upcoming: "warning",
} as const;

/** Every announced version with its email and acceptance counts. */
export const LegalHistoryTable = ({
  items,
}: {
  items: AdminLegalVersionSummary[];
}) => {
  const t = useTranslations("admin.system.legal");
  const formatDate = useLegalDate();

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
        {t("history.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("history.version")}</TableHead>
            <TableHead>{t("history.effective")}</TableHead>
            <TableHead>{t("history.delivery")}</TableHead>
            <TableHead>{t("history.acceptances")}</TableHead>
            <TableHead className="text-end">{t("history.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {t("version", { version: item.version })}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={STATUS_VARIANT[item.status]}>
                      {t(`status.${item.status}`)}
                    </Badge>
                    <Badge variant="outline">
                      {item.requiresAcceptance
                        ? t("requires_acceptance")
                        : t("informational")}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <time dateTime={item.effectiveAt}>
                  {formatDate(item.effectiveAt)}
                </time>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 text-sm">
                  <Badge variant="success">
                    {t("delivery.sent")}: {item.deliveries.sent}
                  </Badge>
                  {item.deliveries.pending > 0 ? (
                    <Badge variant="secondary">
                      {t("delivery.pending")}: {item.deliveries.pending}
                    </Badge>
                  ) : null}
                  {item.deliveries.failed > 0 ? (
                    <Badge variant="destructive">
                      {t("delivery.failed")}: {item.deliveries.failed}
                    </Badge>
                  ) : null}
                  {item.fanout?.incidentAt ? (
                    <Badge variant="warning">
                      {t("delivery.incident.title")}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {item.documentType === "terms" ? item.acceptances : "-"}
              </TableCell>
              <TableCell className="text-end">
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  to={`/admin/core/system/legal/${item.documentType}/versions/${item.id}`}
                >
                  {t("history.view")}
                  <span className="sr-only">
                    {` ${t("version", { version: item.version })}`}
                  </span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
