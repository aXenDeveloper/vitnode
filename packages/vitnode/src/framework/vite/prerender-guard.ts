import type { NitroModule } from "nitro/types";

const CLIENT_RENDERED_SUSPENSE_BOUNDARY = "<!--$!-->";

export const vitNodePrerenderGuard: NitroModule = {
  name: "vitnode:prerender-guard",
  setup: nitro => {
    nitro.hooks.hook("prerender:generate", route => {
      if (route.error || !route.contentType?.includes("text/html")) return;
      if (!route.contents?.includes(CLIENT_RENDERED_SUSPENSE_BOUNDARY)) return;

      route.error = {
        message:
          "Part of the page threw while prerendering, so only its loading fallback was rendered. Render the page in `vite dev` to see the error.",
        status: 500,
      };
    });
  },
};
