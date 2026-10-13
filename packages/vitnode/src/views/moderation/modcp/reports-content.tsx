import { useTranslations } from "use-intl";

import { FiltersDataTable } from "@/components/table/filters";
import { SearchDataTable } from "@/components/table/search";

import type { BoardPerson } from "./board/board-moves";
import type { ModcpBoardFilter } from "./modcp-query";

import { ModcpReportsBoard } from "./board/reports-board";

export const ModcpReportsContent = ({
  description,
  filter,
  me,
  title,
}: {
  description: string;
  filter: ModcpBoardFilter;
  me: BoardPerson;
  title: string;
}) => {
  const t = useTranslations("core.moderation.modcp.reports");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          {title}
        </h1>
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {description}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="bg-card ring-foreground/10 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 shadow-xs ring-1">
          <div className="min-w-48 flex-1">
            <SearchDataTable searchPlaceholder={t("search_placeholder")} />
          </div>
          <FiltersDataTable
            filters={[
              {
                id: "assigned",
                label: t("filters.assigned"),
                options: [
                  { label: t("filters.me"), value: "me" },
                  { label: t("filters.unassigned"), value: "unassigned" },
                ],
                single: { allLabel: t("filters.any") },
              },
            ]}
          />
        </div>

        <ModcpReportsBoard filter={filter} me={me} />
      </div>
    </div>
  );
};
