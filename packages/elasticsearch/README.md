# (VitNode) Elasticsearch Search Adapter

This package provides an [Elasticsearch](https://www.elastic.co/) search-engine
adapter for VitNode's content discovery. It implements the `SearchProviderApiPlugin`
interface: indexing, deletion, rebuild, and querying with advanced ranking
(time-decay and author-boost via `function_score`).

The canonical index always lives in `core_search_index`, so switching from the
default Postgres engine to Elasticsearch is a config change followed by a rebuild.

<p align="center">
  <br>
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode Logo" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="400">
    </picture>
  </a>
  <br>
  <br>
</p>

## Usage

```ts title="src/vitnode.api.config.ts"
import { ElasticsearchSearchAdapter } from "@vitnode/elasticsearch";

export const vitNodeApiConfig = buildApiConfig({
  search: {
    adapter: ElasticsearchSearchAdapter({
      node: process.env.ELASTICSEARCH_NODE,
      apiKey: process.env.ELASTICSEARCH_API_KEY,
      index: "vitnode",
      ranking: {
        timeDecay: { scale: "30d", decay: 0.5 },
      },
    }),
  },
});
```

| Cloud        | Self-Hosted  | Links                                                              | Documentation                                    |
| ------------ | ------------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| ✅ Supported | ✅ Supported | [NPM Package](https://www.npmjs.com/package/@elastic/elasticsearch) | [Docs](https://vitnode.com/docs/dev/search)      |
