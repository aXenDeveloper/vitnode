import type { MetadataRoute } from 'next';

import { rootRobots } from 'vitnode-frontend/robots';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const robots = await rootRobots();

  return robots;
}
