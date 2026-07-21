"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const UserAdminTabs = ({
  overview,
  timeline,
}: {
  overview: React.ReactNode;
  timeline: React.ReactNode;
}) => {
  const t = useTranslations("core.search");

  return (
    <Tabs className="mx-auto w-full max-w-lg gap-4" defaultValue="overview">
      <TabsList className="w-full">
        <TabsTrigger value="overview">{t("userTab.overview")}</TabsTrigger>
        <TabsTrigger value="timeline">{t("userTab.timeline")}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="timeline">{timeline}</TabsContent>
    </Tabs>
  );
};
