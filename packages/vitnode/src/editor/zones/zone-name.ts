import { CONTENT_ZONE_SEPARATOR } from "@vitnode/api/blocks/const";
import { isContentZoneId } from "@vitnode/api/blocks/zone-meta";

const SEGMENT_JOINER = " · ";

const sentenceCase = (segment: string): string => {
  const words = segment.replaceAll("-", " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const zoneDisplayName = (id: string): string =>
  isContentZoneId(id)
    ? id.split(CONTENT_ZONE_SEPARATOR).map(sentenceCase).join(SEGMENT_JOINER)
    : id;
