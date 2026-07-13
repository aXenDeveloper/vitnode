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
}) => (
  <LanguagesContext.Provider value={languages}>
    {children}
  </LanguagesContext.Provider>
);

export const useLanguages = (): LocaleConfig[] => React.use(LanguagesContext);
