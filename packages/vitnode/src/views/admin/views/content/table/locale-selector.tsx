"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import React from "react";

import { useLanguages } from "@/components/languages-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/lib/navigation";

/** The value that means "no language column", rather than a locale. */
const SHARED = "__shared__";

/**
 * Which language the AdminCP list is being *viewed* in.
 *
 * A view control and not a filter, which is the whole point: an admin list is a
 * list of records, and hiding the ones a translator has not reached yet is the
 * opposite of what somebody choosing a language is looking for. Picking Polish
 * adds a column showing each record's Polish title and status - including
 * `Missing`, which is the row that most needs finding.
 *
 * The choice lives in the URL rather than in state, so it survives a reload,
 * paginates with the table and can be shared with whoever is doing the
 * translating. Changing it resets the cursor: page three of the English ordering
 * is not page three of anything else.
 */
export const ContentLocaleSelector = ({
  defaultLocale,
}: {
  defaultLocale: string;
}) => {
  const t = useTranslations("core.content.translations");
  const languages = useLanguages();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = searchParams.get("locale") ?? SHARED;

  const onChange = (raw: unknown) => {
    const value = typeof raw === "string" ? raw : SHARED;
    const next = new URLSearchParams(searchParams.toString());

    if (value === SHARED) {
      next.delete("locale");
    } else {
      next.set("locale", value);
    }
    // A cursor is a position in one ordering. Carrying it across a change of
    // view would land on a page that means something else.
    next.delete("cursor");

    router.push(`${pathname}?${next.toString()}`);
  };

  if (languages.length === 0) return null;

  return (
    <Select onValueChange={onChange} value={current}>
      <SelectTrigger className="w-44" size="sm">
        <SelectValue placeholder={t("shared_tab")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SHARED}>{t("shared_tab")}</SelectItem>
        {languages.map(language => (
          <SelectItem key={language.code} value={language.code}>
            {language.name}
            {language.code === defaultLocale ? ` (${t("default_locale")})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
