import type { ContentApiFetch } from "@/views/admin/views/content/content-request";

import { rawFetcher } from "@/tanstack/fetcher";
import { contentApiFetcher } from "@/views/admin/views/content/content-request";

export const contentApiFetch: ContentApiFetch = contentApiFetcher(rawFetcher);
