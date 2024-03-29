import { lazy, type LazyExoticComponent } from "react";

import { getSessionData } from "@/functions/get-session-data";

export default async function Page() {
  const { default_plugin, theme_id } = await getSessionData();
  const PageFromTheme: LazyExoticComponent<() => JSX.Element> = lazy(() =>
    import(`@/themes/${theme_id}/${default_plugin}/default-page`).catch(
      () => import(`@/themes/1/${default_plugin}/default-page`)
    )
  );

  return <PageFromTheme />;
}
