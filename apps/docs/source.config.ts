import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import jsonSchema from "fumadocs-mdx/plugins/json-schema";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  plugins: [jsonSchema()],
});
