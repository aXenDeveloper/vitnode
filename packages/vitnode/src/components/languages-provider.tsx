"use client";

import React from "react";

import type { LocaleConfig } from "@/vitnode.config";

const LanguagesContext = React.createContext<LocaleConfig[]>([]);

export const LanguagesProvider = ({
  children,
  languages,
}: {
  children: React.ReactNode;
  languages: LocaleConfig[];
}) => {
  const enabled = React.useMemo(
    () => languages.filter(language => language.enabled !== false),
    [languages],
  );

  return (
    <LanguagesContext.Provider value={enabled}>
      {children}
    </LanguagesContext.Provider>
  );
};

export const useLanguages = (): LocaleConfig[] => React.use(LanguagesContext);
