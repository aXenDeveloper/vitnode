import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";

import { manifest } from "@/manifest.gen";

interface HelloMessage {
  message: string;
}

export const route = definePluginRoute<HelloMessage>({
  load: async () => {
    const response = await fetcher({
      plugin: manifest.id,
      method: "get",
      module: "hello",
      path: "/",
    });

    return await response.json();
  },
});

const HomePage = ({ loaderData }: PluginRoutePageProps<HelloMessage>) => {
  const t = useTranslations("newsroom");

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t("home.title")}
      </h1>

      <p className="text-muted-foreground leading-relaxed text-pretty">
        {t("home.desc")}
      </p>

      <div className="bg-card text-card-foreground flex flex-col gap-1 rounded-lg border p-4">
        <span className="text-muted-foreground text-sm">{t("home.api")}</span>
        <span className="font-medium">{loaderData.message}</span>
      </div>
    </div>
  );
};

export default HomePage;
